import {
  SessionAllocator,
  type PresentationMode,
  type SessionKind,
  type SessionPresentationPort,
  type SessionRef,
} from '../presentation/PresentationSession'
import { EventBus } from '../events/EventBus'

import { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'


import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'

import { BuffPersistence } from '../buff2/BuffPersistence'
import { CANONICAL_ELEMENTAL_SEALS, createElementalStateRegistry } from '../reaction/ElementalStateRegistry'
import { FunctionCombatRng } from '../battle/runtime/rng/FunctionCombatRng'

import { NodeRegistry } from '../progression/NodeRegistry'
import { getSkillCoreLevel, skillCoreNodeId } from '../progression/SkillCoreLevel'
import { turnSkillDisplayMetaOf } from '../../data/skill/TurnSkillDisplayMeta'

import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { PassiveSystem } from '../skill/PassiveSystem'
import type { Skill } from '../skill/Skill'

import { TechniqueManager } from '../technique/TechniqueManager'
import { TechniqueSystem } from '../technique/TechniqueSystem'
import type { Technique } from '../technique/Technique'

import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'

import { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import { EquipmentBag } from '../equipment/EquipmentBag'
import { EquipmentSystem } from '../equipment/EquipmentSystem'
import { DecomposeSystem } from '../production/DecomposeSystem'
import { createDefaultEquipmentOperationCostCatalog } from '../equipment/EquipmentOperationCostCatalog'
import { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import { AffixRegistry } from '../equipment/AffixRegistry'


import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { PillSystem } from '../pill/PillSystem'


import { TalismanRegistry } from '../talisman/TalismanRegistry'

import { FormationRegistry } from '../formation/FormationRegistry'

import { ItemRegistry } from '../item/ItemRegistry'

import { ProductionSystem } from '../production/ProductionSystem'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_PRODUCTION_SITES,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_GROTTO_HERBS,
} from '../production/ProductionCatalog'
import {
  hiddenBeastChannels,
  hiddenGrottoChannels,
} from '../../data/drop/HiddenMaterialChannels'
import {
  AlchemySystem,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'

import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'

import { EnemyManager } from '../enemy/EnemyManager'
import { EnemySystem } from '../enemy/EnemySystem'
import type { Enemy } from '../enemy/Enemy'
import type { NotificationEvent } from '../notification/NotificationEvent'

import { StageManager } from '../stage/StageManager'
import { StageSystem } from '../stage/StageSystem'
import type { Stage } from '../stage/Stage'
import { ZoneRegistry } from '../stage/ZoneRegistry'

import { TemplateRegistry } from './TemplateRegistry'
import { NotificationQueue } from './NotificationQueue'
import { BattleLootSystem } from './BattleLootSystem'
import { StageWaveSystem } from './StageWaveSystem'
import { EquipmentOpsSystem } from './EquipmentOpsSystem'
import { GameManagerBuildingOps } from './GameManagerBuildingOps'
import { GameManagerAlchemyOps } from './GameManagerAlchemyOps'
import { GameManagerQuestOps } from './GameManagerQuestOps'
import { GameManagerCompanionOps } from './GameManagerCompanionOps'
import { GameManagerSaveRestore } from './GameManagerSaveRestore'
import { GameManagerCatalogOps } from './GameManagerCatalogOps'
import { GameManagerRewardOps } from './GameManagerRewardOps'
import { GameManagerProgressionOps } from './GameManagerProgressionOps'
import { GameManagerRealmAdvanceOps } from './GameManagerRealmAdvanceOps'
import { GameManagerPersistentEffectOps } from './GameManagerPersistentEffectOps'
import { GameManagerEconomyOps } from './GameManagerEconomyOps'
import { GameManagerPillOps } from './GameManagerPillOps'
import { GameManagerTickOps } from './GameManagerTickOps'
import { GameManagerTurnBattleOps, type ResumePlayback } from './GameManagerTurnBattleOps'
import { HiddenBeastSystem } from './HiddenBeastSystem'
import { TribulationDirector, type ActiveTribulationState } from '../tribulation/TribulationDirector'
import { BreakthroughOutcomeService } from '../tribulation/BreakthroughOutcomeService'

import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import { QuestSystem } from '../quest/QuestSystem'



// Re-export for legacy import compatibility (useTribulation.ts imports
// ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS from GameManager).
export { TRIBULATION_COOLDOWN_SECONDS } from '../tribulation/TribulationDirector'
export type { ActiveTribulationState } from '../tribulation/TribulationDirector'
export type {
  PresentationHold,
  PresentationMode,
  SessionKind,
  SessionPresentationPort,
  SessionRef,
} from '../presentation/PresentationSession'

// Turn-based pacing constants moved into GameManagerTurnBattleOps (C2 split)
// - re-exported for existing import sites (TurnActionPresentationEvents,
// intro-phase/action-playback tests).
export { COUNTDOWN_TOTAL_TICKS, INTRO_TOTAL_TICKS, type ResumePlayback } from './GameManagerTurnBattleOps'
export {
  buildTurnBattleEntitySnapshot,
  type TurnBattleEntitySnapshotEvent,
  type TurnBattleEntityVisualState,
} from '../battle/turn/TurnActionPresentationEvents'
import type { TurnBattleEntitySnapshotEvent } from '../battle/turn/TurnActionPresentationEvents'


import { RewardSystem } from '../reward/RewardSystem'
import type { BattleRewardSummary } from '../reward/BattleRewardSummary'


import { resolvePlayerFinalStats, type PlayerData } from '../player/Player'

import { SPELL_KIT_IDS, SPELL_ROUTE_SKILL_IDS } from '../../data/skill/Skills'
import {
  NEUTRAL_ROUTE_PROFILE,
  resolveRouteProfile,
  type RouteProfile,
} from '../phap-tu/PhapTuRoutes'
import { resolveCultivationPathRuntime } from '../player/CultivationPathRegistry'
import type { CultivationPathRuntime, CultivationPathRuntimeDeps } from '../player/CultivationPathRuntime'
import {
  getActiveElement,
  getActiveRoute,
  hasPathCapability,
  hasStaticPathCapability,
  resolvePathCapabilities,
} from '../player/CultivationPathSystem'
import { resolveCombatBuild } from './CombatBuild'
import { COMPANIONS } from '../../data/companion/Companions'
import type { PathCapability, PathCapabilityDeps } from '../player/CultivationPathKit'





import type { Stats } from '../stats/StatBlock'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { CombatRng } from '../battle/contracts/rng'
import type {
  ClockSource,
  CombatClockState,
  FreezeReason,
} from '../battle/turn/CombatClock'
import type { TokenState } from '../battle/turn/TurnToken'
import type { ForcedTurnChoice } from '../battle/turn/TurnSkillAction'
import type { TurnSkillPresentationEntry } from '../combat/CombatSkillPresentation'
import { BUFF_REGISTRY, PERSISTENT_BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { TRUC_CO_DAN_PILL_ID } from '../../data/breakthrough/BreakthroughScopedResources'


/**
 * GameManager la orchestrator (2026-08-24 refactor - tach business logic
 * tran dau dang dien ra sang 3 service trong cung thu muc):
 *
 * 1. Khoi tao va giu instance cua moi Manager/System + wire dependency
 *    cho BattleLootSystem (loot/particle/toast/battle summary),
 *    StageWaveSystem (wave Man + boss summon), TribulationSystem
 *    (runtime Do Kiep) - xem constructor().
 * 2. Dieu phoi update(deltaSeconds) moi tick cho cac system co yeu to
 *    thoi gian (Buff, Skill, Battle) qua fixed-step catch-up.
 * 3. Tong hop modifier tu nhieu nguon (buff/technique/skill).
 * 4. Giu public API on dinh cho Vue layer/tests: cac method con lai chu
 *    yeu la facade delegate xuong system tuong ung.
 *
 * Toan bo logic that (dieu kien hoc skill, cach tinh reward...) nam
 * trong cac System tuong ung.
 */

// Trang thai Tribulation (ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS)
// da chuyen sang TribulationSystem.ts - GameManager re-export o dau file.

// Uncommitted audit followup plan, muc "Fixed-step/catch-up cho combat"
// (2026-08-24) - App.vue do deltaSeconds THAT giua 2 lan tick() bang
// GameClock (xem App.vue's tick()); khi tab bi trinh duyet throttle
// (background/minimize) hoac may vua resume sau suspend, deltaSeconds
// cua MOT lan goi co the lon bat thuong. battleSystem.update()/
// StageWaveSystem.update() chi kiem tra timer <= 0 MOT LAN moi loi goi
// roi reset ve moc moi (cadence skill, attackTimer, spawnCountdown) -
// KHONG co vong lap catch-up nhu updateKimThe()/TribulationSystem.update(), nen
// phan no (timer am sau) bi vut bo thang: mot khoang deltaSeconds lon
// chi tao ra DUNG 1 don danh/1 lan spawn thay vi nhieu lan dung theo
// nhip that. Chia deltaSeconds thanh cac buoc co dinh nho khi goi cac
// ham phu thuoc timer-dem-nguoc-roi-reset nay sua dung goc van de ma
// khong can viet lai vong lap catch-up rieng cho tung timer.
// Turn-Based Wave Redesign constants (COUNTDOWN_TOTAL_TICKS/INTRO_TOTAL_TICKS)
// now live in GameManagerTurnBattleOps - re-exported above for existing
// imports (TurnActionPresentationEvents, intro-phase tests). The battle
// fixed-step pacing constants moved with the driving loop.

export class GameManager {
  readonly eventBus = new EventBus()


  readonly combatSystem = new CombatSystem(this.eventBus)

  // Thien phu Bat Tu The (talent-direction-choice-plan sec.6) - guard giu luot
  // song sot battle-scoped; combatSystem.killIfDead() la diem tieu thu.
  readonly surviveLethalGuard = new SurviveLethalGuard()

  // M13: the legacy engine INSTANCES here served
  // only the retired legacy helpers (EnemyAttackSystem,
  // SkillEffectResolver). The damage contracts stay live (turn engine
  // uses scaleActionDamage/ActionDamageInfo) - only these orphaned
  // fields are gone.
  // buff2 M4 -- the persistent (out-of-battle) buff pool: ONE authority
  // scoped to the 'player' subject (Kiep Thuong-family debuffs). No
  // scheduler exists out of battle, so the lane uses the local
  // BuffPersistence driver (its registry carries only non-periodic
  // defs). Stats resolve through the ambient player path lazily (the
  // same precedence applyPersistentBuff uses); the sink is a no-op --
  // persistent events aren't traced.
  readonly persistentBuffs = new BuffPersistence({
    ownerId: 'player',
    registry: PERSISTENT_BUFF_REGISTRY,
    stats: {
      getStats: () => {
        const player = this.activePlayer
        return player === undefined ? undefined : this.resolveAmbientPlayerStats(player)
      },
    },
    entities: { isAlive: () => true },
    snapshots: { capture: () => ({}) },
    elemental: createElementalStateRegistry(CANONICAL_ELEMENTAL_SEALS),
    rng: new FunctionCombatRng(() => Math.random()),
    sink: { emit: () => {} },
  })

  readonly skillManager = new SkillManager()
  readonly skillSystem = new SkillSystem(this.skillManager)

  /**
   * M-QI-05 - the ONE battle-snapshot skill-level projection: reads
   * nodeLevels through registered Core Nodes (levelsSkillId), then
   * tops up learned templates lacking a core (fixed Lv1) with 1. Fed
   * into CombatEntity.skillLevels at build; combat reads it verbatim.
   */
  private projectCanonicalSkillLevels(source: PlayerData | undefined): Record<string, number> {
    const projected: Record<string, number> = {}

    for (const [nodeId, level] of Object.entries(source?.nodeLevels ?? {})) {
      if (level > 0 && this.nodeRegistry.has(nodeId)) {
        const skillId = this.nodeRegistry.get(nodeId).levelsSkillId

        if (skillId !== undefined) {
          projected[skillId] = level
        }
      }
    }

    for (const skill of this.skillManager.getAll()) {
      projected[skill.id] ??= 1
    }

    return projected
  }

  /**
   * M-QI-05 - canonical skill level-up notification, shared by the
   * Insight channel (progressionOps.levelUpSkill) and the cast channel
   * (the castCountSink below). Name resolution: learned Skill template
   * -> native TurnSkillDisplayMeta -> raw id.
   */
  private pushSkillLevelUpNotification(skillId: string, newLevel: number, levelsGained: number): void {
    const name =
      this.skillManager.get(skillId)?.name ??
      this.skillTemplates.get(skillId)?.name ??
      turnSkillDisplayMetaOf(skillId)?.name ??
      skillId

    this.notifications.push({
      kind: 'upgrade',
      message:
        levelsGained === 1
          ? `${name} đạt cấp ${newLevel}`
          : `${name} tăng ${levelsGained} cấp, đạt cấp ${newLevel}`,
      messageKey: levelsGained === 1 ? 'notifications.skillLevelUp' : 'notifications.skillLevelUpMulti',
      messageParams: {
        name,
        level: String(newLevel),
        gained: String(levelsGained),
      },
    })
  }
  readonly passiveSystem = new PassiveSystem(
    this.eventBus,
    this.skillManager,
    this.skillSystem,
    // Talent v4 (spec 2026-09-03 sec.3.3 E2) - buffApplier: apply the
    // passiveConvertsTo "burst" buff to the PLAYER in the current battle.
    // Rewired 2026-09-07 (Phase A2) from the legacy real-time battle to
    // the turn-based one - the legacy battleSystem does not run during
    // real gameplay, so this previously never fired (silent gap, see
    // docs/superpowers/specs/2026-09-07-phase-a2-buff-content-wiring-design.md).
    // buff2 M4 -- the applier delegates to the ops seam: the battle's
    // buff authority applies through an authored op (mid-settlement
    // fires ride the in-flight drain), and the ops layer owns the
    // unknown-id skip + quiescent-settle decision.
    (buffId) => {
      this.turnBattleOps.applyBuffToPlayer(buffId)
    },
    // hpReader - player entity's HP ratio in the current turn-based
    // battle; undefined outside battle (passiveCondition treats this as
    // pass-through). Rewired alongside buffApplier, same reason.
    () => {
      const player = this.turnBattleOps.getTurnBattle()?.players[0]

      if (!player || player.entity.maxHp <= 0) {
        return undefined
      }

      return player.entity.currentHp / player.entity.maxHp
    },
  )

  // Phap Tu Redesign (magicpath) - Node Tree, ha tang CHUNG cho moi
  // path, xem core/progression/.
  readonly nodeRegistry = new NodeRegistry()

  // =========================
  // TURN-BASED COMBAT - engine duy nhat dieu khien combat (C1 2026-09-08:
  // legacy real-time BattleSystem + mirror Battle object da XOA cung
  // battle/legacy/. M13 2026-09-14: the getBattle() `as unknown as Battle`
  // cast is retired - consumers read getTurnBattle() (TurnBattle | null)).
  // C2 (2026-09-08): runtime lifecycle (TurnBattle construction, fixed-step
  // driving loop, rewards, auto-farm) moved verbatim into
  // GameManagerTurnBattleOps - the methods below are thin delegates keeping
  // the public API unchanged for Vue/tests (same pattern as the earlier
  // Equipment/Building/Alchemy/Quest/Save Ops splits).
  readonly turnBattleOps: GameManagerTurnBattleOps

  readonly techniqueManager = new TechniqueManager()
  readonly techniqueSystem = new TechniqueSystem(this.techniqueManager)

  readonly materialRegistry = new MaterialRegistry()
  readonly materialBag = new MaterialBag()

  readonly equipmentRegistry = new EquipmentRegistry()
  readonly equipmentBag = new EquipmentBag()
  readonly equipmentSystem = new EquipmentSystem(createDefaultEquipmentOperationCostCatalog())

  // Task 14 (rework P4) - Decompose tab: ore -> refined essence.
  // R7 (AR-08): capacity is dynamic - supplied per tick/restore via
  // updateCapacity from the workforce authority (CHQ).
  readonly decomposeSystem = new DecomposeSystem(this.materialBag)

  // Core Loop Foundation checklist (Phase 3, Muc AFFIX) - thay the
  // hoan toan substatPool cu.
  readonly affixRegistry = new AffixRegistry()

  // MASTER SPEC Muc XVI (Phase 9) - Cuong Hoa song o day (theo SLOT,
  // 6 slot co dinh), tach khoi EquipmentInstance.
  readonly equipmentSlotManager = new EquipmentSlotManager()

  readonly pillRegistry = new PillRegistry()
  readonly pillBag = new PillBag()
  readonly pillSystem = new PillSystem()

  // Phu/Tran legacy (2026-08-25, plan sec.10.1.4) - registry giu lai CHI
  // DOC nhu tombstone de save cu khong crash vi registry lookup; KHONG
  // con bag, KHONG dang ky content moi dung duoc.
  readonly talismanRegistry = new TalismanRegistry()
  readonly formationRegistry = new FormationRegistry()

  readonly itemRegistry = new ItemRegistry(
    this.equipmentRegistry,
    this.pillRegistry,
    this.talismanRegistry,
    this.materialRegistry,
  )

  // =========================
  // Production (2026-08-25, resource-professions-rework plan sec.4) -
  // thay ExplorationSystem: ba nguon Lam/Quang/Dong Thien cua Thanh Van
  // dung chung engine cycle snapshot + settle idempotent.
  // =========================
  readonly productionSystem = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
    hiddenGrottoChannels: hiddenGrottoChannels(),
  })

  // Dan Phong (plan sec.8) - job luyen dan voi reserve atomic.
  readonly alchemySystem = new AlchemySystem()

  private alchemyRecipesById = new Map<string, AlchemyRecipe>()

  readonly buildingRegistry = new BuildingRegistry()
  readonly buildingManager = new BuildingManager()
  readonly buildingSystem = new BuildingSystem()

  readonly questRegistry = new QuestRegistry()
  readonly questManager = new QuestManager()
  readonly questSystem = new QuestSystem()

  readonly enemyManager = new EnemyManager()
  readonly enemySystem = new EnemySystem(this.enemyManager)

  readonly stageManager = new StageManager()
  readonly stageSystem = new StageSystem()

  readonly rewardSystem = new RewardSystem()

  // Session tran dang dien ra (receiver nhan thuong + PlayerData de roll
  // loot) da chuyen vao BattleLootSystem - xem constructor().

  // Beta Phase 4 (Notification/UX) - hang doi toast phat sinh TRONG
  // core (loot tu BattleLootSystem, upgrade skill tu callback o tren).
  private readonly notifications = new NotificationQueue()

  // =========================
  // RUNTIME SERVICES (2026-08-24 tach khoi than class nay)
  // =========================

  // The three services below own the business logic of a running fight:
  // - BattleLootSystem: loot/particle/toast/battle summary on kill.
  // - StageWaveSystem: awaits the stage's next wave + boss summon.
  // - TribulationDirector: the new chapter runtime (mind quiz + tank
  //   lightning, spec dot-pha-loi-kiep sec.5) + cooldown.
  // Constructed in the constructor (NOT field initializers) because they
  // reference fields declared LATER (bags/registries/zoneRegistry/
  // template registries) - field initializers run in declaration order
  // and cannot see them; the ctor body runs after all fields, safely.

  private readonly battleLoot: BattleLootSystem
  private readonly stageWaves: StageWaveSystem
  readonly tribulationDirector: TribulationDirector
  private readonly breakthroughOutcomeService = new BreakthroughOutcomeService()
  readonly equipmentOps: EquipmentOpsSystem
  readonly buildingOps: GameManagerBuildingOps
  readonly alchemyOps: GameManagerAlchemyOps
  readonly questOps: GameManagerQuestOps
  readonly companionOps: GameManagerCompanionOps
  readonly saveOps: GameManagerSaveRestore
  private readonly sessionAllocator = new SessionAllocator()

  // Static data registration + template/stage/zone catalog lookups.
  // Public: callers use gameManager.catalogOps.* directly (no facade).
  readonly catalogOps: GameManagerCatalogOps

  // Reward issuing (player RewardReceiver, skill insight, giveReward).
  // Public: callers use gameManager.rewardOps.* directly (no facade).
  readonly rewardOps: GameManagerRewardOps

  // Node Tree / combat roles / talent-sync progression operations.
  // Public: callers use gameManager.progressionOps.* directly (no facade).
  readonly progressionOps: GameManagerProgressionOps

  // Realm advance: canonical technique grant, cultivation path, artifact,
  // realm passives, body refinement, breakthrough gate.
  // Public: callers use gameManager.realmAdvanceOps.* directly (no facade).
  readonly realmAdvanceOps: GameManagerRealmAdvanceOps

  // Persistent/live modifier authority (timed effects, sockets,
  // aggregation, persistent buffs, Tu Linh Tran).
  // Public: callers use gameManager.effectOps.* directly (no facade).
  readonly effectOps: GameManagerPersistentEffectOps

  // Vendor economy operations.
  // Public: callers use gameManager.economyOps.* directly (no facade).
  readonly economyOps: GameManagerEconomyOps

  // Pill consumption operations.
  // Public: callers use gameManager.pillOps.* directly (no facade).
  readonly pillOps: GameManagerPillOps

  // Per-tick orchestration (update() settle loop, decompose delivery,
  // quest lifecycle reconciliation).
  // Public: callers use gameManager.tickOps.* directly (no facade).
  readonly tickOps: GameManagerTickOps

  // Hidden beast (spec dot-pha-loi-kiep sec.4.1c) - the 1000-kill
  // Qi Refining window.
  readonly hiddenBeastSystem: HiddenBeastSystem

  constructor() {
    // Kiem Tu (2026-08-28) - mirror player.skillCastCounts moi lan
    // cast, phuc vu NodeSystem prerequisite `skillCastCount`
    // (NodeSystem chi nhan PlayerData, khong co SkillManager). Ghi vao
    // activePlayer (dang ky qua setActivePlayer(), xem field ben duoi)
    // - no-op an toan neu chua co player active (vd unit test dung
    // GameManager tran). M-QI-05 - the cast channel now writes the
    // canonical Core Node level (nodeLevels[core_<id>]) when the cast
    // target advances; the notification fires only on a true increase
    // (delta reported for multi-level jumps).
    this.skillSystem.setCastCountSink((skillId, totalExperience, targetLevel) => {
      if (!this.activePlayer) return

      this.activePlayer.skillCastCounts ??= {}
      this.activePlayer.skillCastCounts[skillId] = totalExperience

      if (targetLevel === undefined) {
        return
      }

      const coreId = skillCoreNodeId(skillId)
      const priorLevel = this.activePlayer.nodeLevels?.[coreId] ?? 0

      if (targetLevel > priorLevel) {
        this.activePlayer.nodeLevels ??= {}
        this.activePlayer.nodeLevels[coreId] = targetLevel
        this.pushSkillLevelUpNotification(skillId, targetLevel, targetLevel - priorLevel)
      }
    })

    // M-QI-05 - canonical level provider: every live skill-level read
    // (getEffectiveSkill/progressionOf/passive scaling) resolves
    // nodeLevels[core_<id>] on the active player. A core read of 0 means
    // the skill is fixed-level (maxLevel 1, no core granted) - the live
    // level is still 1. Unwired/no-player contexts fall back to Lv1
    // inside SkillSystem.
    this.skillSystem.setSkillLevelProvider((skillId) =>
      this.activePlayer ? getSkillCoreLevel(this.activePlayer, skillId) || 1 : 1,
    )

    // P7-M6 - mirror player.techniqueProgress each time the canonical
    // holder's {rank, grade} can change (grant/rank-up/grade-advance/
    // restore). Same contract as the cast-count sink above: NodeSystem's
    // techniqueRank/techniqueGrade prerequisites read PlayerData only.
    // `progress ?? undefined` keeps the declared-default shape - an
    // emptied holder returns the key to its undefined default rather
    // than leaving a stale record or a deleted key.
    this.techniqueSystem.setProgressSink((progress) => {
      if (!this.activePlayer) return

      this.activePlayer.techniqueProgress = progress ?? undefined
    })

    // Phap Tu Reimagined Task 3 - ONE scoping closure for both route
    // seams: the provider feeds getEffectiveSkill's effective-surface
    // application AND the post-conversion applyRouteToTurnSkill call at
    // the orchestration sites below. Neutral unless the active player
    // is normal spell with an element and the skill is a kit member.
    this.routeProfileProvider = (skillId) => {
      const player = this.activePlayer

      // P1 - the gate is the declared capability, not the way predicate.
      if (player === undefined || !hasStaticPathCapability(player, 'spell.elemental_casting')) {
        return NEUTRAL_ROUTE_PROFILE
      }

      const element = getActiveElement(player)

      if (
        !element ||
        (!SPELL_KIT_IDS[element].includes(skillId) &&
          !SPELL_ROUTE_SKILL_IDS[element].includes(skillId))
      ) {
        return NEUTRAL_ROUTE_PROFILE
      }

      const route = getActiveRoute(player)

      if (!route) {
        return NEUTRAL_ROUTE_PROFILE
      }

      return resolveRouteProfile({ element, route })
    }

    this.skillSystem.setRouteProfileProvider(this.routeProfileProvider)

    // Hidden beast (spec dot-pha-loi-kiep sec.4.1c) resolves its
    // template through the shared registry (registerEnemyTemplates
    // already registered Huyet Mieu via ENEMIES).
    this.catalogOps = new GameManagerCatalogOps({
      materialRegistry: this.materialRegistry,
      buffRegistry: BUFF_REGISTRY,
      buildingRegistry: this.buildingRegistry,
      questRegistry: this.questRegistry,
      alchemyRecipesById: this.alchemyRecipesById,
      alchemySystem: this.alchemySystem,
      equipmentRegistry: this.equipmentRegistry,
      affixRegistry: this.affixRegistry,
      pillRegistry: this.pillRegistry,
      formationRegistry: this.formationRegistry,
      talismanRegistry: this.talismanRegistry,
      zoneRegistry: this.zoneRegistry,
      nodeRegistry: this.nodeRegistry,
      skillTemplates: this.skillTemplates,
      techniqueTemplates: this.techniqueTemplates,
      enemyTemplates: this.enemyTemplates,
      stageTemplates: this.stageTemplates,
    })

    this.rewardOps = new GameManagerRewardOps({
      rewardSystem: this.rewardSystem,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      notifications: this.notifications,
      // Deferred closure - questOps is assigned later in this constructor.
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
    })

    // P7-M4 - ONE override-aware path-runtime binding shared by combat
    // (turnBattleOps) and presentation (progressionOps.getResolvedSkillRoles):
    // a test-installed resolver (setPathRuntimeResolver) resolves
    // identically for both consumers - the UI can never diverge from combat.
    const pathRuntimeDeps: CultivationPathRuntimeDeps = {
      skillManager: this.skillManager,
      skillSystem: this.skillSystem,
      skillTemplates: this.skillTemplates,
      nodeRegistry: this.nodeRegistry,
      getNodeLevel: (nodeId, p) => this.progressionOps.getNodeLevel(nodeId, p),
      getSpellPathElement: () => this.progressionOps.getSpellPathElement(),
      routeProfileProvider: this.routeProfileProvider,
    }
    this.pathRuntimeResolver = (player) =>
      (this.pathRuntimeResolverOverride ??
        ((p: PlayerData) => resolveCultivationPathRuntime(p, pathRuntimeDeps)))(player)

    this.progressionOps = new GameManagerProgressionOps({
      nodeRegistry: this.nodeRegistry,
      skillTemplates: this.skillTemplates,
      skillSystem: this.skillSystem,
      skillManager: this.skillManager,
      getActivePlayer: () => this.activePlayer,
      // P7-M4 - the shared override-aware binding (above), NOT a second
      // deps-literal: combat and the resolved-role display consume the
      // same runtime resolution.
      resolvePathRuntime: this.pathRuntimeResolver,
      // Lazy read - turnBattleOps is constructed after progressionOps.
      isTurnBattleInProgress: () => this.turnBattleOps?.isTurnBattleInProgress() ?? false,
      // Deferred closure - turnBattleOps is assigned later.
      getTurnBattle: () => this.turnBattleOps.getTurnBattle(),
      // M-QI-05 - Insight-channel level-up notification (cast channel
      // notifies via the castCountSink above - one owner per channel).
      onSkillLevelUp: (skillId, newLevel, levelsGained) =>
        this.pushSkillLevelUpNotification(skillId, newLevel, levelsGained),
      sessionRng: () => this.sessionRng(),
    })

    this.realmAdvanceOps = new GameManagerRealmAdvanceOps({
      techniqueManager: this.techniqueManager,
      techniqueTemplates: this.techniqueTemplates,
      techniqueSystem: this.techniqueSystem,
      skillManager: this.skillManager,
      skillSystem: this.skillSystem,
      skillTemplates: this.skillTemplates,
      nodeRegistry: this.nodeRegistry,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      pillBag: this.pillBag,
      breakthroughOutcomeService: this.breakthroughOutcomeService,
      progressionOps: this.progressionOps,
      // Deferred closures - turnBattleOps/activePlayer are assigned later.
      getTurnBattle: () => this.turnBattleOps.getTurnBattle(),
      // Deferred closure - tickOps is assigned later in this constructor.
      markQuestRealmTransition: () => this.tickOps.markQuestRealmTransition(),
      // Deferred closures - questOps is assigned later in this
      // constructor (same pattern as the other funnel subscribers).
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
    })

    this.effectOps = new GameManagerPersistentEffectOps({
      persistentBuffs: this.persistentBuffs,
      skillSystem: this.skillSystem,
      techniqueManager: this.techniqueManager,
      nodeRegistry: this.nodeRegistry,
      equipmentBag: this.equipmentBag,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      // Deferred closure - activePlayer assigned later.
      getActivePlayer: () => this.activePlayer,
    })

    this.economyOps = new GameManagerEconomyOps({
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      // Deferred closures - alchemyOps/questOps assigned later.
      getAlchemyRecipes: () => this.alchemyOps.getAlchemyRecipes(),
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
    })

    this.pillOps = new GameManagerPillOps({
      pillBag: this.pillBag,
      pillRegistry: this.pillRegistry,
      pillSystem: this.pillSystem,
      applyTimedEffect: (player, effect) => this.effectOps.applyTimedEffect(player, effect),
    })

    this.hiddenBeastSystem = new HiddenBeastSystem({
      getEnemyTemplate: (id) => this.catalogOps.getEnemyTemplate(id),
      channels: hiddenBeastChannels(),
    })

    this.battleLoot = new BattleLootSystem({
      eventBus: this.eventBus,
      notifications: this.notifications,
      combatSystem: this.combatSystem,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      pillRegistry: this.pillRegistry,
      pillBag: this.pillBag,
      equipmentRegistry: this.equipmentRegistry,
      equipmentBag: this.equipmentBag,
      equipmentSystem: this.equipmentSystem,
      affixRegistry: this.affixRegistry,
      zoneRegistry: this.zoneRegistry,
      techniqueSystem: this.techniqueSystem,
      enemySystem: this.enemySystem,
      rewardSystem: this.rewardSystem,
      stageManager: this.stageManager,
      stageTemplates: this.stageTemplates,
      questSystem: this.questSystem,
      questRegistry: this.questRegistry,
      questManager: this.questManager,
      // Deferred closure - questOps is assigned later in this constructor.
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
      hiddenBeast: this.hiddenBeastSystem,
    })

    this.stageWaves = new StageWaveSystem({
      eventBus: this.eventBus,
      enemySystem: this.enemySystem,
      stageManager: this.stageManager,
      stageSystem: this.stageSystem,
      stageTemplates: this.stageTemplates,
      enemyTemplates: this.enemyTemplates,
      isStageUnlocked: (stageId, player) => this.catalogOps.isStageUnlocked(stageId, player),
      launchBattle: (player, enemy) =>
        this.startBattleWithPlayer(player, enemy),
      hiddenBeast: this.hiddenBeastSystem,
      sessionRng: () => this.sessionRng(),
    })

    this.tribulationDirector = new TribulationDirector({
      eventBus: this.eventBus,
      sessionAllocator: this.sessionAllocator,
    })

    this.equipmentOps = new EquipmentOpsSystem({
      equipmentSystem: this.equipmentSystem,
      equipmentBag: this.equipmentBag,
      equipmentRegistry: this.equipmentRegistry,
      equipmentSlotManager: this.equipmentSlotManager,
      affixRegistry: this.affixRegistry,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      buildingManager: this.buildingManager,
      buildingRegistry: this.buildingRegistry,
      buildingSystem: this.buildingSystem,
      notifications: this.notifications,
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
      getActivePlayer: () => this.activePlayer,
    })

    this.buildingOps = new GameManagerBuildingOps({
      buildingRegistry: this.buildingRegistry,
      buildingManager: this.buildingManager,
      buildingSystem: this.buildingSystem,
      productionSystem: this.productionSystem,
      decomposeSystem: this.decomposeSystem,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      notifications: this.notifications,
      getActivePlayer: () => this.activePlayer,
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
    })

    this.alchemyOps = new GameManagerAlchemyOps({
      alchemySystem: this.alchemySystem,
      alchemyRecipesById: this.alchemyRecipesById,
      buildingManager: this.buildingManager,
      buildingRegistry: this.buildingRegistry,
      buildingSystem: this.buildingSystem,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
    })

    this.questOps = new GameManagerQuestOps({
      questSystem: this.questSystem,
      questRegistry: this.questRegistry,
      questManager: this.questManager,
      rewardSystem: this.rewardSystem,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      pillRegistry: this.pillRegistry,
      pillBag: this.pillBag,
      notifications: this.notifications,
      getActivePlayer: () => this.activePlayer,
      buildPlayerRewardReceiver: (player) => this.rewardOps.buildPlayerRewardReceiver(player),
    })

    this.companionOps = new GameManagerCompanionOps({
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      notifications: this.notifications,
      getActivePlayer: () => this.activePlayer,
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
    })

    this.saveOps = new GameManagerSaveRestore({
      skillManager: this.skillManager,
      skillTemplates: this.skillTemplates,
      techniqueSystem: this.techniqueSystem,
      techniqueTemplates: this.techniqueTemplates,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      pillRegistry: this.pillRegistry,
      pillBag: this.pillBag,
      equipmentRegistry: this.equipmentRegistry,
      equipmentBag: this.equipmentBag,
      equipmentSystem: this.equipmentSystem,
      equipmentSlotManager: this.equipmentSlotManager,
      affixRegistry: this.affixRegistry,
      buildingRegistry: this.buildingRegistry,
      buildingManager: this.buildingManager,
      questManager: this.questManager,
      productionSystem: this.productionSystem,
      alchemySystem: this.alchemySystem,
      notifications: this.notifications,
      getActivePlayer: () => this.activePlayer,
      sessionRng: () => this.sessionRng(),
      refreshAutoWorkerCapacity: (player, instance) =>
        this.buildingOps.refreshAutoWorkerCapacity(player, instance),
      getWorkerAssignments: () => this.buildingOps.getWorkerAssignments(),
      settleAutoFarmOffline: (player, elapsedSeconds) =>
        this.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, elapsedSeconds),
      reconcileAutoFarmRuntime: (player) =>
        this.turnBattleOps.autoFarmOps.reconcileAutoFarmRuntime(player),
      decomposeSystem: this.decomposeSystem,
      // Deferred closures - tickOps is assigned later in this constructor.
      deliverDecomposeOutput: (entry) => this.tickOps.deliverDecomposeOutput(entry),
      reconcileQuestLifecycle: () => this.tickOps.reconcileQuestLifecycle(),
      reconcileRealmRewards: (player) =>
        this.realmAdvanceOps.reconcileCultivationPathRealmRewards(player),
      reconcileSpecClaims: (player) => this.progressionOps.reconcileSpecClaims(player),
      tribulationDirector: this.tribulationDirector,
    })

    // Turn-battle runtime ops (C2 split, 2026-09-08) - owns the TurnBattle
    // lifecycle/fixed-step loop/rewards/auto-farm. Initialized LAST because
    // it reads this.battleLoot/stageWaves/saveRestore-adjacent state and the
    // getActivePlayer() closure below references this.activePlayer, which is
    // assigned later (same deferred-read pattern as the other Ops objects).
    this.turnBattleOps = new GameManagerTurnBattleOps({
      eventBus: this.eventBus,
      combatSystem: this.combatSystem,
      battleLoot: this.battleLoot,
      stageWaves: this.stageWaves,
      stageManager: this.stageManager,
      enemySystem: this.enemySystem,
      enemyManager: this.enemyManager,
      enemyTemplates: this.enemyTemplates,
      stageTemplates: this.stageTemplates,
      surviveLethalGuard: this.surviveLethalGuard,
      sessionAllocator: this.sessionAllocator,
      getActivePlayer: () => this.activePlayer,
      resetPassiveStacks: () => this.passiveSystem.resetStacks(),
      // P2 - the canonical build resolver; GameManager binds the
      // CombatBuildDeps (stat channels, capabilities, registries). Ops
      // passes the source/runtime/override; the resolver composes the
      // rest. Called inside the post-reset window (ARCH-002 M7): the
      // static partition bakes baseStats, the live partition reaches
      // entity.stats via build.liveModifiers at every refresh.
      resolveCombatBuild: (source, runtime, primaryEntityOverride) =>
        resolveCombatBuild(source, runtime, {
          getBattleBaseChannels: (player) => this.effectOps.getBattleBaseChannels(player),
          resolveCapabilities: (player) =>
            resolvePathCapabilities(player, {
              hasSkill: (skillId) => this.skillManager.has(skillId),
            }),
          // M-QI-05 - canonical snapshot projection: registered Core
          // Nodes' levelsSkillId -> nodeLevels level (covers learned
          // template skills AND native defs); learned fixed-Lv1
          // templates without a core project 1. Unknown/unregistered
          // core_* keys never project. Reads the BUILD SOURCE player -
          // a supplied PlayerData battles with its own nodeLevels, not
          // ambient activePlayer state.
          getSkillLevels: () => this.projectCanonicalSkillLevels(source),
          getProgressionNodes: () => this.nodeRegistry.getAll(),
          getCompanionDefinition: (id) => COMPANIONS.find((candidate) => candidate.id === id),
          getLiveBattleModifiers: (player) => this.effectOps.getLiveBattleModifiers(player),
          getActivePlayer: () => this.activePlayer,
        }, primaryEntityOverride),
      getLiveBattleModifiers: (player) => this.effectOps.getLiveBattleModifiers(player),
      bankPassiveCarry: (player) => this.passiveSystem.bankBattleCarryStacks(player),
      seedPassiveCarry: (player) => this.passiveSystem.seedBattleCarryStacks(player),
      buildPlayerRewardReceiver: (player) => this.rewardOps.buildPlayerRewardReceiver(player),
      // Mission C Task 9 - the ONLY path-dispatch call left in the
      // orchestration layer: every basic/special/maxThe/provider/survive
      // resolution funnels through the registry runtime. P7-M4 - the
      // shared override-aware binding (constructed above): the UI
      // accessor consumes the identical resolution.
      resolvePathRuntime: this.pathRuntimeResolver,
      recordPrimaryPlayerCast: (skillId) => this.skillSystem.recordCast(skillId),
    })

    // Tick orchestration (C3 split) - constructed LAST because it reads
    // the ops/services above (effectOps/realmAdvanceOps/turnBattleOps/
    // tribulationDirector) and saveRestore-adjacent deferred closures
    // point back into it.
    this.tickOps = new GameManagerTickOps({
      getActivePlayer: () => this.activePlayer,
      tickTimedEffects: (player) => this.effectOps.tickTimedEffects(player),
      investBodyChapter: (player) => this.realmAdvanceOps.investBodyChapter(player, 'body_refinement'),
      questSystem: this.questSystem,
      questRegistry: this.questRegistry,
      questManager: this.questManager,
      notifyMaterialGained: (materialId, amount) =>
        this.questOps.notifyMaterialGained(materialId, amount),
      notifications: this.notifications,
      productionSystem: this.productionSystem,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      decomposeSystem: this.decomposeSystem,
      getWorkerAssignments: () => this.buildingOps.getWorkerAssignments(),
      alchemySystem: this.alchemySystem,
      pillBag: this.pillBag,
      pillRegistry: this.pillRegistry,
      persistentBuffs: this.persistentBuffs,
      passiveSystem: this.passiveSystem,
      turnBattleOps: this.turnBattleOps,
      tribulationDirector: this.tribulationDirector,
      sessionRng: () => this.sessionRng(),
    })
  }

  // Skill/Technique khong "register" san co toan bo danh sach goc
  // vao manager - chung chi duoc add khi nguoi choi thuc su hoc
  // (learn), dung nhu SkillSystem.learn()/TechniqueSystem.learn()
  // da thiet ke. GameManager chi cung cap noi tra cuu template.
  private skillTemplates = new TemplateRegistry<Skill>()
  private techniqueTemplates = new TemplateRegistry<Technique>()

  // Enemy template tra theo id (dung boi StageSystem khi chon quai
  // ke tiep de spawn) - cung pattern skillTemplates/techniqueTemplates,
  // KHAC EnemyManager (chi chua instance da spawn, co id rieng tung
  // con - xem EnemySystem.spawn()).
  private enemyTemplates = new TemplateRegistry<Enemy>()

  // Stage template tra theo id - cung pattern enemyTemplates.
  private stageTemplates = new TemplateRegistry<Stage>()

  // Tham Hiem rework - Dia Gioi (nhom nhieu Stage/Man), xem
  // core/stage/Zone.ts. Registry that (khong phai Map tran nhu
  // stageTemplates) vi StageSelectPanel.vue can getAll()/has() truc
  // tiep, khong chi tra theo id don le.
  readonly zoneRegistry = new ZoneRegistry()

  private activePlayer?: PlayerData

  /** Phap Tu Reimagined Task 3 - kit-scoped route profile lookup shared
   * by the SkillSystem provider and the post-conversion seam below. */
  private routeProfileProvider!: (skillId: string) => RouteProfile

  // P1 - stable dep binding for the path-capability facade: learned-skill
  // membership lives in SkillManager, not PlayerData, so conditional
  // capabilities consume it through this injected predicate.
  private readonly pathCapabilityDeps: PathCapabilityDeps = {
    hasSkill: (skillId) => this.skillManager.has(skillId),
  }

  // P7-M4 - dev/test runtime-resolver override, owned HERE (was
  // turnBattleOps.pathRuntimeOverride): the shared binding consults it
  // so combat AND the resolved-role display see the same runtime.
  private pathRuntimeResolverOverride:
    | ((player: PlayerData) => CultivationPathRuntime)
    | undefined
  private readonly pathRuntimeResolver: (player: PlayerData) => CultivationPathRuntime

  /**
   * App.vue dang ky player sau boot/load - update() dung de tick expiry
   * timed effect theo Date.now().
   */
  setActivePlayer(player: PlayerData) {
    this.activePlayer = player

    // Save load: immediately drain expired timed effects (plan sec.9).
    this.effectOps.tickTimedEffects(player)

    // Talent v4 (spec 2026-09-03 sec.4.1): grant the combat talent's
    // hidden passive the moment the active player is set (save load /
    // restore / post-creation ceremony).
    this.progressionOps.syncTalentCombatPassive(player)
  }

  /**
   * P1 - bound path-capability facade for presentation/feature consumers:
   * resolves the ACTIVE player's capability set with skill membership
   * already bound (skillManager.has). Bridges/panels call this instead of
   * carrying PathCapabilityDeps themselves. False when no player is
   * active - fail closed, same as the resolver.
   */
  hasPathCapability(capability: PathCapability): boolean {
    const player = this.activePlayer
    if (player === undefined) {
      return false
    }
    return hasPathCapability(player, capability, this.pathCapabilityDeps)
  }

  // =========================
  // BATTLE - thin delegates to GameManagerTurnBattleOps (C2 split). All
  // real logic (TurnBattle construction, fixed-step driving, rewards,
  // auto-farm) lives in GameManagerTurnBattleOps.ts verbatim.
  // =========================

  startBattle(player: CombatEntity, enemy: Enemy) {
    this.turnBattleOps.startBattle(player, enemy)
  }

  // Mission C Task 9 - the path-integration resolvers that lived here
  // moved to src/core/player/CultivationPathRegistry.ts (the single
  // dispatch site); the ops consume the runtime via resolvePathRuntime.

  /** Current turn-based state - internal consumers flip to this. */
  getTurnBattle(): TurnBattle | null {
    return this.turnBattleOps.getTurnBattle()
  }

  // buff2 M4 -- live buff snapshots for the combat UI (turn-order strip
  // badges); delegates to the ops read seam ([] outside battle).
  getBattleBuffs(entityId: string) {
    return this.turnBattleOps.getBattleBuffs(entityId)
  }

  /** Stage that launched the current turn battle (null for non-stage battles). */
  getActiveTurnBattleStage(): Stage | null {
    return this.turnBattleOps.getActiveTurnBattleStage()
  }

  // --- Combat Runtime Separation (Task 1, 2026-09-07, AGENTS.md P17) -------
  // Presentation-ack timing state machine lives in CombatAnimationRuntime
  // (owned by GameManagerTurnBattleOps since the C2 split). GameManager keeps
  // only thin forwarders below so the public contract CombatScene.ts relies
  // on is unchanged.

  /** Bat/tat manual mode. Tat giua luc dang cho choice -> huy pause, engine tu chay tiep. */
  setBattleManualMode(enabled: boolean): void {
    this.turnBattleOps.setBattleManualMode(enabled)
  }

  isBattleManualMode(): boolean {
    return this.turnBattleOps.presentationOps.isBattleManualMode()
  }

  /** Dang pause cho player chon skill cho luot cua chinh minh? */
  isAwaitingManualTurnChoice(): boolean {
    return this.turnBattleOps.isAwaitingManualTurnChoice()
  }

  // --- Combat clock + turn token (2026-09-10 combat-turn-mechanism spec) ---

  /**
   * Install the source combat counts from. The browser installs a
   * RafClockSource so the battle advances exactly as fast as it is drawn;
   * tests install a ManualClockSource and step it themselves.
   */
  setCombatClockSource(source: ClockSource): void {
    this.turnBattleOps.setCombatClockSource(source)
  }

  /**
   * Mission C Task 8 - seed every battle cycle's RNG. The factory runs
   * once per beginBattleCycle; pass `() => new SeededCombatRng(seed)`
   * in tests for deterministic combat (combat-contract M4: the minted
   * unit is a typed CombatRng). `undefined` restores Math.random.
   */
  setBattleRngFactory(factory: (() => CombatRng) | undefined): void {
    this.turnBattleOps.setBattleRngFactory(factory)
  }

  /**
   * P6 - seed the LOOT/economy drop rolls (resolveDrops per-kill lane).
   * Deliberately a separate stream from setBattleRngFactory: a seeded
   * battle must not pin drops, but deterministic sessions still need
   * replayable reward settlement. `undefined` restores Math.random.
   */
  setLootRng(rng: (() => number) | undefined): void {
    this.battleLoot.setLootRng(rng)
  }

  // F-W-7 session rng seam — one injectable stream for non-combat,
  // non-loot rolls (alchemy yields, Van Dao free-purchase, hidden-beast
  // substitution, breakthrough talent draw). `undefined` restores
  // Math.random. Deterministic harnesses pin it like setLootRng.
  private rngSource: () => number = () => Math.random()

  sessionRng(): number {
    return this.rngSource()
  }

  setSessionRng(rng: (() => number) | undefined): void {
    this.rngSource = rng ?? (() => Math.random())
  }

  /**
   * Mission C Task 9 - dev/test seam mirroring setBattleRngFactory:
   * override the cultivation-path runtime resolver (e.g. a test-only
   * fake_path runtime). `undefined` restores the registry dispatch.
   */
  setPathRuntimeResolver(
    resolver: ((player: PlayerData) => CultivationPathRuntime) | undefined,
  ): void {
    // P7-M4 - the override lives on the SHARED binding (constructed in
    // the ctor): combat and the resolved-role UI accessor resolve
    // through the same seam.
    this.pathRuntimeResolverOverride = resolver
  }

  freezeCombat(reason: FreezeReason): void {
    this.turnBattleOps.freezeCombat(reason)
  }

  /**
   * External command boundary (spec section 9). A command never mutates
   * battle state at the moment it arrives: it runs immediately when there is
   * no boundary to wait for (no battle, or the token is already idle), and
   * otherwise waits for the next RESOLVING -> IDLE transition.
   */
  enqueueAtTurnBoundary(command: () => void): void {
    this.turnBattleOps.enqueueAtTurnBoundary(command)
  }

  resumeCombat(reason: FreezeReason): void {
    this.turnBattleOps.resumeCombat(reason)
  }

  getCombatClockState(): CombatClockState {
    return this.turnBattleOps.getCombatClockState()
  }

  getElapsedCombatSteps(): number {
    return this.turnBattleOps.getElapsedCombatSteps()
  }

  /** @internal - diagnostics; the freeze reason set is the engine's channel. */
  getFreezeReasons(): readonly FreezeReason[] {
    return this.turnBattleOps.getFreezeReasons()
  }

  /** @internal - for tests and the dev inspector, never for gameplay code. */
  getTurnTokenState(): TokenState {
    return this.turnBattleOps.getTurnTokenState()
  }

  /** The single predicate for "a turn is in flight" (spec section 2). */
  isTurnInFlight(): boolean {
    return this.turnBattleOps.isTurnInFlight()
  }

  setPresentationMode(mode: PresentationMode): void {
    this.turnBattleOps.presentationOps.setPresentationMode(mode)
    this.tribulationDirector.setPresentationMode(mode)
  }

  getPresentationMode(): PresentationMode {
    return this.turnBattleOps.presentationOps.getPresentationMode()
  }

  /**
   * Without `kind` this answers "any active session", combat first - that is a
   * recovery query for the coordinator, NOT an identity source for a caller
   * that just issued a start command. Entry points MUST pass their kind:
   * combat and tribulation sessions can be active at the same time (a terminal
   * battle may still sit at Home), so an unscoped read can hand back the other
   * owner's session and produce a request the coordinator must reject.
   */
  getCurrentPresentationSession(kind?: SessionKind): SessionRef | null {
    if (kind === 'combat') {
      return this.turnBattleOps.presentationOps.getCurrentPresentationSession()
    }

    if (kind === 'tribulation') {
      return this.tribulationDirector.getCurrentPresentationSession()
    }

    return (
      this.turnBattleOps.presentationOps.getCurrentPresentationSession() ??
      this.tribulationDirector.getCurrentPresentationSession() ??
      null
    )
  }

  getPresentationPort(): SessionPresentationPort {
    return {
      getCurrentSession: () => this.getCurrentPresentationSession(),
      isCurrentSession: (session) =>
        this.getCurrentPresentationSession(session.kind)?.sessionId === session.sessionId,
      hold: (session) => {
        if (session.kind === 'combat') {
          return this.turnBattleOps.presentationOps.getPresentationPort().hold(session)
        }
        if (session.kind === 'tribulation') {
          return this.tribulationDirector.getPresentationPort().hold(session)
        }
        return null
      },
      attach: (token) => {
        return (
          this.turnBattleOps.presentationOps.getPresentationPort().attach(token) ||
          this.tribulationDirector.getPresentationPort().attach(token)
        )
      },
      release: (token) => {
        return (
          this.turnBattleOps.presentationOps.getPresentationPort().release(token) ||
          this.tribulationDirector.getPresentationPort().release(token)
        )
      },
      detach: (token, policy) => {
        return (
          this.turnBattleOps.presentationOps.getPresentationPort().detach(token, policy) ||
          this.tribulationDirector.getPresentationPort().detach(token, policy)
        )
      },
    }
  }

  getTribulationPresentationSnapshot(sessionId: number): { sessionId: number; state: ActiveTribulationState } | null {
    return this.tribulationDirector.getPresentationSnapshot(sessionId)
  }

  /** True while the current interactive session is held by the coordinator. */
  isAwaitingPresentationLayer(): boolean {
    return this.turnBattleOps.presentationOps.isAwaitingPresentationLayer()
  }

  /** Test/UI doc token hien tai cua phase dang cho (null neu khong pending). */
  getPendingPlaybackToken(): string | null {
    return this.turnBattleOps.presentationOps.getPendingPlaybackToken()
  }

  preparePresentationResume(): ResumePlayback | null {
    return this.turnBattleOps.presentationOps.preparePresentationResume()
  }

  getCombatPresentationSnapshot(sessionId: number): {
    sessionId: number
    entities: TurnBattleEntitySnapshotEvent
  } | null {
    return this.turnBattleOps.presentationOps.getCombatPresentationSnapshot(sessionId)
  }

  setPresentationActive(active: boolean): void {
    this.turnBattleOps.presentationOps.setPresentationActive(active)
  }

  isActionPlaybackWaiting(): boolean {
    return this.turnBattleOps.presentationOps.isActionPlaybackWaiting()
  }

  /** Phaser goi khi ready flourish xong -> declare action, phat 'attack'. */
  acknowledgeTurnReady(token?: string): void {
    this.turnBattleOps.presentationOps.acknowledgeTurnReady(token)
  }

  /** Phaser goi tai impact frame (lunge tween xong) -> ap damage, phat VFX. */
  acknowledgeActionImpact(token?: string): void {
    this.turnBattleOps.presentationOps.acknowledgeActionImpact(token)
  }

  /** Phaser goi khi VFX tween xong -> turn cleanup, phat standby tail. */
  acknowledgeActionComplete(token?: string): void {
    this.turnBattleOps.presentationOps.acknowledgeActionComplete(token)
  }

  /**
   * UI submit choice cho luot dang pause. Tra false neu khong co pause
   * (no-op an toan - choice bi bo, khong crash).
   */
  submitTurnChoice(choice: ForcedTurnChoice): boolean {
    return this.turnBattleOps.submitTurnChoice(choice)
  }

  /**
   * Danh cho UI: id cua actor dang pause (luon la 'player' o engine hien
   * tai - party nhieu nguoi la redesign tuong lai), null khi khong pause.
   */
  consumeAwaitedActorId(): string | null {
    return this.turnBattleOps.presentationOps.consumeAwaitedActorId()
  }

  /**
   * Slice 7 - presentation facade: buildTurnSkillPresentation cho tran
   * turn hien tai (isPlayerTurnPaused = manual pause dang cho choice).
   * Party (Task 10): khi pause, presentation theo PAUSED ACTOR (bat ky
   * party member nao), khong co dinh players[0].
   */
  buildTurnSkillPresentation(
    battle: TurnBattle,
    isPlayerTurnPaused: boolean,
  ): {
    basic: TurnSkillPresentationEntry
    special: TurnSkillPresentationEntry
    ultimate: TurnSkillPresentationEntry
  } {
    return this.turnBattleOps.presentationOps.buildTurnSkillPresentation(battle, isPlayerTurnPaused)
  }

  getBattleRewardSummary(): BattleRewardSummary {
    return this.battleLoot.getSummary()
  }

  /**
   * Tien ich: bat dau tran dau thang tu PlayerData thay vi phai
   * tu convert sang CombatEntity truoc. ARCH-002 (M7): the resolved
   * base is computed inside the ops AFTER the passive reset (single
   * resolvePlayerFinalStats owner) - callers no longer pass a snapshot.
   */
  startBattleWithPlayer(player: PlayerData, enemy: Enemy) {
    this.turnBattleOps.startBattleWithPlayer(player, enemy)
  }

  /**
   * Loi Kiep (spec dot-pha-loi-kiep sec.5.1) delegates down to
   * TribulationDirector (the new chapter runtime: mind quiz + tank
   * lightning, NOT through BattleSystem, no Kiep monsters).
   * hasTrucCoDan reads from PillBag (the Dia/Thien-grade admission
   * token, never consumed). Tu Thu's prayer does not stack inside the
   * kiep (the real ritual keeps the old pattern): the kiep runs outside
   * combat so there is no session to apply it to.
   */

  /**
   * ARCH-002 (M7) - resolved stat snapshot for non-turn-engine paths
   * (tribulation ghost, Kiep Thuong debuff scaling): the same modifier
   * union the menu mirror serves (aggregated + runtime), resolved through
   * the single owner resolvePlayerFinalStats. Callers needing a
   * stack-clean snapshot must reset ephemeral passive state FIRST - see
   * startTribulation below.
   */
  resolveAmbientPlayerStats(player: PlayerData): Stats {
    return resolvePlayerFinalStats(player, [
      ...this.effectOps.getAggregatedModifiers(player),
      ...this.effectOps.getActiveRuntimeModifiers(player),
    ])
  }

  startTribulation(
    player: PlayerData,
    targetRealmId: string,
  ): boolean {
    // One admission authority: the same predicate rows the UI and the
    // sim precheck (release policy + level/chapter) gate tribulation
    // entry here too - fail-closed when nothing is attemptable.
    if (!this.realmAdvanceOps.canTriggerBreakthrough(player)) {
      return false
    }

    // M-F-CEILING C2C-9 - the breakthrough-gate pill id comes from the
    // census so the integrity test binds the live gate to the tag.
    const hasTrucCoDan = this.pillBag.has(TRUC_CO_DAN_PILL_ID, 1)

    // ARCH-002 (M7) - same ordering contract as startBattleWithPlayer:
    // ephemeral passive stacks reset BEFORE the ghost snapshot is taken,
    // so leftover battle stacks can never leak into the tribulation tank.
    this.passiveSystem.resetStacks()
    const playerStats = this.resolveAmbientPlayerStats(player)

    return this.tribulationDirector.start(player, playerStats, hasTrucCoDan, targetRealmId)
  }

  /**
   * Player manually abandons the battle mid-fight (the "Thoat Tran"
   * button in CombatControlBar.vue, confirmed before reaching here) -
   * REUSES the existing 'defeat' flow instead of a new BattleState/UI:
   * set battle.state = 'defeat' then publish 'battle_end' THROUGH
   * rewardOps.emitAbandonEnd() - the same once-guard as natural
   * terminal states (victory/defeat) so a fight fires exactly once
   * (ARCH-014, M12; previously abandon emitted by itself while a
   * natural defeat stayed silent for audio/scene/cache).
   * updateStageProgress() STOPS the stageManager on the next tick when
   * it sees 'defeat' (see its note) - nothing else to clean up here.
   * Earned rewards (grantBattleRewardIfNeeded() runs EVERY tick per
   * kill, not at fight end) are NOT lost by abandoning. Stage battles
   * only - Tribulation has its own win/lose flow (useTribulation.ts);
   * the "Thoat Tran" button is hidden there (see CombatControlBar.vue).
   */
  abandonBattle(): boolean {
    return this.turnBattleOps.abandonBattle()
  }

  /**
   * The Vue layer (App.vue's tick()) calls this each tick to drain
   * toasts produced inside core since the last call - returns and
   * clears the queue.
   */
  drainNotifications(): NotificationEvent[] {
    return this.notifications.drain()
  }
}
