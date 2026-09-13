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

import type { Battle } from '../battle/Battle'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'


import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'

import { BuffPool } from '../buff/BuffPool'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import type { BuffDefinition } from '../buff/BuffDefinition'

import { NodeRegistry } from '../progression/NodeRegistry'

import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
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



// Re-export gi? tuong thï¿½ch import cu (useTribulation.ts import
// ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS t? GameManager).
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


import type { PlayerData } from '../player/Player'

import { CHAIN_SKILL_IDS } from '../../data/skill/Skills'





import type { Stats } from '../stats/StatBlock'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type {
  ClockSource,
  CombatClockState,
  FreezeReason,
} from '../battle/turn/CombatClock'
import type { TokenState } from '../battle/turn/TurnToken'
import type { TurnSkillDefinition, TurnSkillSlotRole } from '../battle/turn/TurnSkillAction'
import type { TurnSkillPresentationEntry } from '../combat/CombatSkillPresentation'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { PHAP_TU_REACTION_SPECIAL, PHAP_TU_REACTION_ULTIMATE } from '../../data/skill/TurnReactionPathSkills'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { toTurnSkillDefinition } from './SkillToTurnSkillConverter'

/**
 * GameManager là orchestrator (2026-08-24 refactor — tách business logic
 * trận đấu đang diễn ra sang 3 service trong cùng thư mục):
 *
 * 1. Khởi tạo và giữ instance của mọi Manager/System + wire dependency
 *    cho BattleLootSystem (loot/particle/toast/battle summary),
 *    StageWaveSystem (wave Màn + boss summon), TribulationSystem
 *    (runtime Độ Kiếp) — xem constructor().
 * 2. Điều phối update(deltaSeconds) mỗi tick cho các system có yếu tố
 *    thời gian (Buff, Skill, Battle) qua fixed-step catch-up.
 * 3. Tổng hợp modifier từ nhiều nguồn (buff/technique/skill).
 * 4. Giữ public API ổn định cho Vue layer/tests: các method còn lại chủ
 *    yếu là facade delegate xuống system tương ứng.
 *
 * Toàn bộ logic thật (điều kiện học skill, cách tính reward...) nằm
 * trong các System tương ứng.
 */

// Trạng thái Tribulation (ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS)
// đã chuyển sang TribulationSystem.ts — GameManager re-export ở đầu file.

// Uncommitted audit followup plan, mục "Fixed-step/catch-up cho combat"
// (2026-08-24) — App.vue đo deltaSeconds THẬT giữa 2 lần tick() bằng
// GameClock (xem App.vue's tick()); khi tab bị trình duyệt throttle
// (background/minimize) hoặc máy vừa resume sau suspend, deltaSeconds
// của MỘT lần gọi có thể lớn bất thường. battleSystem.update()/
// StageWaveSystem.update() chỉ kiểm tra timer <= 0 MỘT LẦN mỗi lời gọi
// rồi reset về mốc mới (cadence skill, attackTimer, spawnCountdown) —
// KHÔNG có vòng lặp catch-up như updateKimThe()/TribulationSystem.update(), nên
// phần nợ (timer âm sâu) bị vứt bỏ thẳng: một khoảng deltaSeconds lớn
// chỉ tạo ra ĐÚNG 1 đòn đánh/1 lần spawn thay vì nhiều lần đúng theo
// nhịp thật. Chia deltaSeconds thành các bước cố định nhỏ khi gọi các
// hàm phụ thuộc timer-đếm-ngược-rồi-reset này sửa đúng gốc vấn đề mà
// không cần viết lại vòng lặp catch-up riêng cho từng timer.
// Turn-Based Wave Redesign constants (COUNTDOWN_TOTAL_TICKS/INTRO_TOTAL_TICKS)
// now live in GameManagerTurnBattleOps - re-exported above for existing
// imports (TurnActionPresentationEvents, intro-phase tests). The battle
// fixed-step pacing constants moved with the driving loop.

export class GameManager {
  readonly eventBus = new EventBus()


  readonly combatSystem = new CombatSystem(this.eventBus)

  // Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — guard giữ lượt
  // sống sót battle-scoped; combatSystem.killIfDead() là điểm tiêu thụ.
  readonly surviveLethalGuard = new SurviveLethalGuard()

  readonly actionImpact = new ActionImpactSystem({
    eventBus: this.eventBus,
    rollCritical: (s, t) => this.combatSystem.rollCritical(s, t),
  })

  readonly buffPool = new BuffPool()
  readonly buffSystem = new BuffSystem(this.buffPool)
  readonly buffRegistry = new BuffRegistry()

  readonly skillManager = new SkillManager()
  readonly skillSystem = new SkillSystem(this.skillManager, (skill, levelsGained) => {
    this.notifications.push({
      kind: 'upgrade',
      message:
        levelsGained === 1
          ? `${skill.name} d?t c?p ${skill.level}`
          : `${skill.name} tang ${levelsGained} c?p, d?t c?p ${skill.level}`,
    })
  })
  readonly skillEffectSystem = new SkillEffectSystem()
  readonly passiveSystem = new PassiveSystem(
    this.eventBus,
    this.skillManager,
    this.skillSystem,
    // Talent v4 (spec 2026-09-03 §3.3 E2) — buffApplier: apply the
    // passiveConvertsTo "burst" buff to the PLAYER in the current battle.
    // Rewired 2026-09-07 (Phase A2) from the legacy real-time battle to
    // the turn-based one — the legacy battleSystem does not run during
    // real gameplay, so this previously never fired (silent gap, see
    // docs/superpowers/specs/2026-09-07-phase-a2-buff-content-wiring-design.md).
    (buffId) => {
      const player = this.turnBattleOps.getTurnBattle()?.players[0]

      if (!player) {
        return
      }

      let definition: BuffDefinition | undefined

      try {
        definition = BUFF_REGISTRY.get(buffId)
      } catch {
        definition = undefined
      }

      if (!definition) {
        return
      }

      new BuffSystem(player.buffs).apply(definition, player.entity, player.entity, BUFF_REGISTRY)
    },
    // hpReader — player entity's HP ratio in the current turn-based
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

  // Pháp Tu Redesign (magicpath) — Node Tree, hạ tầng CHUNG cho mọi
  // path, xem core/progression/.
  readonly nodeRegistry = new NodeRegistry()

  // =========================
  // TURN-BASED COMBAT — engine duy nhất điều khiển combat (C1 2026-09-08:
  // legacy real-time BattleSystem + mirror Battle object đã XOÁ cùng
  // battle/legacy/; mọi consumer đọc getBattle() → TurnBattle cast).
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

  // Core Loop Foundation checklist (Phase 3, Mục AFFIX) — thay thế
  // hoàn toàn substatPool cũ.
  readonly affixRegistry = new AffixRegistry()

  // MASTER SPEC Mục XVI (Phase 9) — Cường Hóa sống ở đây (theo SLOT,
  // 6 slot cố định), tách khỏi EquipmentInstance.
  readonly equipmentSlotManager = new EquipmentSlotManager()

  readonly pillRegistry = new PillRegistry()
  readonly pillBag = new PillBag()
  readonly pillSystem = new PillSystem()

  // Phù/Trận legacy (2026-08-25, plan §10.1.4) — registry giữ lại CHỈ
  // ĐỌC như tombstone để save cũ không crash vì registry lookup; KHÔNG
  // còn bag, KHÔNG đăng ký content mới dùng được.
  readonly talismanRegistry = new TalismanRegistry()
  readonly formationRegistry = new FormationRegistry()

  readonly itemRegistry = new ItemRegistry(
    this.equipmentRegistry,
    this.pillRegistry,
    this.talismanRegistry,
    this.materialRegistry,
  )

  // =========================
  // Production (2026-08-25, resource-professions-rework plan §4) —
  // thay ExplorationSystem: ba nguồn Lâm/Quáng/Động Thiên của Thanh Vân
  // dùng chung engine cycle snapshot + settle idempotent.
  // =========================
  readonly productionSystem = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })

  // Đan Phòng (plan §8) — job luyện đan với reserve atomic.
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

  // Session trận đang diễn ra (receiver nhận thưởng + PlayerData để roll
  // loot) đã chuyển vào BattleLootSystem — xem constructor().

  // Beta Phase 4 (Notification/UX) — hàng đợi toast phát sinh TRONG
  // core (loot từ BattleLootSystem, upgrade skill từ callback ở trên).
  private readonly notifications = new NotificationQueue()

  // =========================
  // RUNTIME SERVICES (2026-08-24 tách khỏi thân class này)
  // =========================

  // Ba service du?i dï¿½y s? h?u business logic tr?n d?u dang di?n ra:
  // - BattleLootSystem: loot/particle/toast/battle summary khi quï¿½i ch?t.
  // - StageWaveSystem: vï¿½ng d?i wave c?a Mï¿½n + boss summon.
  // - TribulationDirector: runtime chuong ki?p m?i (tï¿½m ma + tank lï¿½i,
  //   spec dot-pha-loi-kiep ï¿½5) + cooldown.
  // Kh?i t?o trong constructor (KHï¿½NG ph?i field initializer) vï¿½ c?n
  // tham chi?u t?i cï¿½c field khai bï¿½o SAU chï¿½ng ? trï¿½n (bags/registries/
  // zoneRegistry/template registries) ï¿½ field initializer ch?y theo th?
  // t? khai bï¿½o nï¿½n khï¿½ng th?y du?c; ctor body ch?y sau cï¿½ng, an toï¿½n.

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

  // Reward issuing (player RewardReceiver, technique insight, giveReward).
  // Public: callers use gameManager.rewardOps.* directly (no facade).
  readonly rewardOps: GameManagerRewardOps

  // Node Tree / skill loadout / talent-sync progression operations.
  // Public: callers use gameManager.progressionOps.* directly (no facade).
  readonly progressionOps: GameManagerProgressionOps

  // Realm advance: technique learn/equip, cultivation path, artifact,
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

  // Quï¿½i ?n (spec dot-pha-loi-kiep ï¿½4.1c) ï¿½ c?a s? 1000 kill Luy?n Khï¿½.
  readonly hiddenBeastSystem: HiddenBeastSystem

  constructor() {
    // Kiếm Tu (2026-08-28) — mirror player.skillCastCounts/skillLevels
    // mỗi lần cast, phục vụ NodeSystem prerequisite `skillCastCount`
    // (NodeSystem chỉ nhận PlayerData, không có SkillManager). Ghi vào
    // activePlayer (đăng ký qua setActivePlayer(), xem field bên dưới)
    // — no-op an toàn nếu chưa có player active (vd unit test dựng
    // GameManager trần).
    this.skillSystem.setCastCountSink((skillId, totalExperience, level) => {
      if (!this.activePlayer) return

      this.activePlayer.skillCastCounts ??= {}
      this.activePlayer.skillCastCounts[skillId] = totalExperience

      this.activePlayer.skillLevels ??= {}
      this.activePlayer.skillLevels[skillId] = level
    })

    // Quï¿½i ?n (spec dot-pha-loi-kiep ï¿½4.1c) ï¿½ tra template qua registry
    // chung (registerEnemyTemplates dï¿½ dang kï¿½ Huy?t Mï¿½ng qua ENEMIES).
    this.catalogOps = new GameManagerCatalogOps({
      materialRegistry: this.materialRegistry,
      buffRegistry: this.buffRegistry,
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
      techniqueManager: this.techniqueManager,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      notifications: this.notifications,
      // Deferred closure - questOps is assigned later in this constructor.
      notifyQuestMaterialGained: (materialId, amount) =>
        this.questOps.notifyQuestMaterialGained(materialId, amount),
    })

    this.progressionOps = new GameManagerProgressionOps({
      nodeRegistry: this.nodeRegistry,
      skillTemplates: this.skillTemplates,
      skillSystem: this.skillSystem,
      skillManager: this.skillManager,
      getActivePlayer: () => this.activePlayer,
    })

    this.realmAdvanceOps = new GameManagerRealmAdvanceOps({
      techniqueManager: this.techniqueManager,
      techniqueTemplates: this.techniqueTemplates,
      techniqueSystem: this.techniqueSystem,
      skillManager: this.skillManager,
      skillSystem: this.skillSystem,
      skillTemplates: this.skillTemplates,
      materialBag: this.materialBag,
      breakthroughOutcomeService: this.breakthroughOutcomeService,
      progressionOps: this.progressionOps,
      // Deferred closures - turnBattleOps/activePlayer are assigned later.
      getBattle: () => this.getBattle(),
      // Deferred closure - tickOps is assigned later in this constructor.
      markQuestRealmTransition: () => this.tickOps.markQuestRealmTransition(),
    })

    this.effectOps = new GameManagerPersistentEffectOps({
      buffSystem: this.buffSystem,
      buffRegistry: this.buffRegistry,
      skillSystem: this.skillSystem,
      techniqueManager: this.techniqueManager,
      nodeRegistry: this.nodeRegistry,
      equipmentBag: this.equipmentBag,
      equipmentSlotManager: this.equipmentSlotManager,
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      // Deferred closures - turnBattleOps/activePlayer assigned later.
      getActivePlayer: () => this.activePlayer,
      getTurnBattle: () => this.turnBattleOps.getTurnBattle(),
      getSkillRuntimeStats: (player) => this.progressionOps.getSkillRuntimeStats(player),
    })

    this.economyOps = new GameManagerEconomyOps({
      materialRegistry: this.materialRegistry,
      materialBag: this.materialBag,
      // Deferred closures - alchemyOps/questOps assigned later.
      getAlchemyRecipes: () => this.alchemyOps.getAlchemyRecipes(),
      notifyQuestMaterialGained: (materialId, amount) =>
        this.questOps.notifyQuestMaterialGained(materialId, amount),
    })

    this.pillOps = new GameManagerPillOps({
      pillBag: this.pillBag,
      pillRegistry: this.pillRegistry,
      pillSystem: this.pillSystem,
      applyTimedEffect: (player, effect) => this.effectOps.applyTimedEffect(player, effect),
    })

    this.hiddenBeastSystem = new HiddenBeastSystem({
      getEnemyTemplate: (id) => this.catalogOps.getEnemyTemplate(id),
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
      techniqueManager: this.techniqueManager,
      techniqueSystem: this.techniqueSystem,
      techniqueTemplates: this.techniqueTemplates,
      enemySystem: this.enemySystem,
      rewardSystem: this.rewardSystem,
      stageManager: this.stageManager,
      stageTemplates: this.stageTemplates,
      questSystem: this.questSystem,
      questRegistry: this.questRegistry,
      questManager: this.questManager,
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
      launchBattle: (player, playerStats, enemy) =>
        this.startBattleWithPlayer(player, playerStats, enemy),
      hiddenBeast: this.hiddenBeastSystem,
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
      notifyQuestMaterialGained: (materialId, amount) =>
        this.questOps.notifyQuestMaterialGained(materialId, amount),
      getActivePlayer: () => this.activePlayer,
    })

    this.buildingOps = new GameManagerBuildingOps({
      buildingRegistry: this.buildingRegistry,
      buildingManager: this.buildingManager,
      buildingSystem: this.buildingSystem,
      productionSystem: this.productionSystem,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      notifications: this.notifications,
      getActivePlayer: () => this.activePlayer,
      notifyQuestMaterialGained: (materialId, amount) =>
        this.questOps.notifyQuestMaterialGained(materialId, amount),
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
    })

    this.saveOps = new GameManagerSaveRestore({
      skillManager: this.skillManager,
      skillTemplates: this.skillTemplates,
      techniqueManager: this.techniqueManager,
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
      refreshAutoWorkerCapacity: (player, instance) =>
        this.buildingOps.refreshAutoWorkerCapacity(player, instance),
      getWorkerAssignments: () => this.buildingOps.getWorkerAssignments(),
      settleAutoFarmOffline: (player, elapsedSeconds) =>
        this.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, elapsedSeconds),
      decomposeSystem: this.decomposeSystem,
      // Deferred closures - tickOps is assigned later in this constructor.
      deliverDecomposeOutput: (entry) => this.tickOps.deliverDecomposeOutput(entry),
      reconcileQuestLifecycle: () => this.tickOps.reconcileQuestLifecycle(),
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
      getSkillRuntimeStats: (player) => this.progressionOps.getSkillRuntimeStats(player),
      getSkillLevels: () =>
        Object.fromEntries(this.skillManager.getAll().map((skill) => [skill.id, skill.level])),
      resetPassiveStacks: () => this.passiveSystem.resetStacks(),
      bankPassiveCarry: (player) => this.passiveSystem.bankBattleCarryStacks(player),
      seedPassiveCarry: (player) => this.passiveSystem.seedBattleCarryStacks(player),
      buildPlayerRewardReceiver: (player) => this.rewardOps.buildPlayerRewardReceiver(player),
      getPhapTuThuanElement: () => this.progressionOps.getPhapTuThuanElement(),
      resolvePlayerSpecialUltimate: (player) => this.resolvePlayerSpecialUltimate(player),
      recordPrimaryPlayerCast: (skillId) => this.skillSystem.recordCast(skillId),
    })

    // Tick orchestration (C3 split) - constructed LAST because it reads
    // the ops/services above (effectOps/realmAdvanceOps/turnBattleOps/
    // tribulationDirector) and saveRestore-adjacent deferred closures
    // point back into it.
    this.tickOps = new GameManagerTickOps({
      getActivePlayer: () => this.activePlayer,
      tickTimedEffects: (player) => this.effectOps.tickTimedEffects(player),
      investBodyRefinement: (player) => this.realmAdvanceOps.investBodyRefinement(player),
      questSystem: this.questSystem,
      questRegistry: this.questRegistry,
      questManager: this.questManager,
      notifyQuestMaterialGained: (materialId, amount) =>
        this.questOps.notifyQuestMaterialGained(materialId, amount),
      notifications: this.notifications,
      productionSystem: this.productionSystem,
      materialBag: this.materialBag,
      materialRegistry: this.materialRegistry,
      decomposeSystem: this.decomposeSystem,
      getWorkerAssignments: () => this.buildingOps.getWorkerAssignments(),
      alchemySystem: this.alchemySystem,
      pillBag: this.pillBag,
      pillRegistry: this.pillRegistry,
      buffSystem: this.buffSystem,
      passiveSystem: this.passiveSystem,
      turnBattleOps: this.turnBattleOps,
      tribulationDirector: this.tribulationDirector,
    })
  }

  // Skill/Technique không "register" sẵn có toàn bộ danh sách gốc
  // vào manager — chúng chỉ được add khi người chơi thực sự học
  // (learn), đúng như SkillSystem.learn()/TechniqueSystem.learn()
  // đã thiết kế. GameManager chỉ cung cấp nơi tra cứu template.
  private skillTemplates = new TemplateRegistry<Skill>()
  private techniqueTemplates = new TemplateRegistry<Technique>()

  // Enemy template tra theo id (dùng bởi StageSystem khi chọn quái
  // kế tiếp để spawn) — cùng pattern skillTemplates/techniqueTemplates,
  // KHÁC EnemyManager (chỉ chứa instance đã spawn, có id riêng từng
  // con — xem EnemySystem.spawn()).
  private enemyTemplates = new TemplateRegistry<Enemy>()

  // Stage template tra theo id — cùng pattern enemyTemplates.
  private stageTemplates = new TemplateRegistry<Stage>()

  // Thám Hiểm rework — Địa Giới (nhóm nhiều Stage/Màn), xem
  // core/stage/Zone.ts. Registry thật (không phải Map trần như
  // stageTemplates) vì StageSelectPanel.vue cần getAll()/has() trực
  // tiếp, không chỉ tra theo id đơn lẻ.
  readonly zoneRegistry = new ZoneRegistry()

  private activePlayer?: PlayerData

  /**
   * App.vue đăng ký player sau boot/load — update() dùng để tick expiry
   * timed effect theo Date.now().
   */
  setActivePlayer(player: PlayerData) {
    this.activePlayer = player

    // Load save: b? effect dï¿½ h?t h?n ngay (plan ï¿½9).
    this.effectOps.tickTimedEffects(player)

    // Talent v4 (spec 2026-09-03 ï¿½4.1) ï¿½ grant hidden passive c?a
    // talent combat ngay khi active player d?i (load save / restore /
    // sau L? Nh?p Mï¿½n t?o nhï¿½n v?t).
    this.progressionOps.syncTalentCombatPassive(player)
  }

  // =========================
  // BATTLE - thin delegates to GameManagerTurnBattleOps (C2 split). All
  // real logic (TurnBattle construction, fixed-step driving, rewards,
  // auto-farm) lives in GameManagerTurnBattleOps.ts verbatim.
  // =========================

  startBattle(player: CombatEntity, enemy: Enemy) {
    this.turnBattleOps.startBattle(player, enemy)
  }

  /**
   * Ch?n basic attack theo cultivation path c?a player (Completion Task 5
   * mapping ï¿½ 8 builds). Chua ch?n d?o/Th? Tu = generic physical.
   */
  private resolvePlayerBasicAttack(player: PlayerData): TurnSkillDefinition {
    if (player.cultivationPath === 'kiem_tu') {
      return BASIC_ATTACKS_BY_BUILD.kiem_tu!
    }

    if (player.cultivationPath === 'phap_tu') {
      const element = this.progressionOps.getPhapTuThuanElement() ?? 'fire'
      return BASIC_ATTACKS_BY_BUILD[`phap_tu_${element}`] ?? GENERIC_PHYSICAL_BASIC
    }

    return GENERIC_PHYSICAL_BASIC
  }

  /**
   * Phase A3 (2026-09-07) — resolve the player's special/ultimate
   * TurnSkillDefinitions for Pháp Tu builds, via the
   * Skill→TurnSkillDefinition converter. Specialization resolution is
   * entirely SkillSystem.getEffectiveSkill()'s job — this method only
   * reads its output. Mirrors resolvePlayerBasicAttack()'s path/element
   * branching. Kiếm Tu returns {} — its special/ultimate stay in
   * TurnBattleAdapter's static buildId maps (BAT_KIEM_THUAT / the A3
   * Task 4 ultimate), which are native turn-based content, not Skill
   * objects.
   */
  private resolvePlayerSpecialUltimate(
    player: PlayerData,
  ): { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition } {
    if (player.cultivationPath !== 'phap_tu') {
      return {}
    }

    // Phase A4 (2026-09-07) — Reaction Path branch: purchasing ANY
    // `reaction_path_unlock_<tag>` node awakens the hidden path and
    // REPLACES the element chain's special/ultimate with the Reaction
    // Path's marker skills (the engine intercepts the special marker and
    // casts 2 distinct elemental picks; the ultimate self-applies
    // reaction_empowerment). Gating reads player.nodeLevels (§6.8 —
    // PlayerData is the authority), mirroring getPhapTuThuanElement()'s
    // nodeLevels read pattern.
    for (const nodeKey of Object.keys(player.nodeLevels)) {
      if (nodeKey.startsWith('reaction_path_unlock_') && player.nodeLevels[nodeKey]! > 0) {
        return {
          special: PHAP_TU_REACTION_SPECIAL,
          ultimate: PHAP_TU_REACTION_ULTIMATE,
        }
      }
    }

    const element = this.progressionOps.getPhapTuThuanElement() ?? 'fire'
    const [, specialId, ultimateId] = CHAIN_SKILL_IDS[element]

    const specialSkill = this.skillManager.get(specialId)
    const ultimateSkill = this.skillManager.get(ultimateId)

    return {
      special: specialSkill
        ? toTurnSkillDefinition(specialSkill, this.skillSystem.getEffectiveSkill(specialSkill))
        : undefined,
      ultimate: ultimateSkill
        ? toTurnSkillDefinition(ultimateSkill, this.skillSystem.getEffectiveSkill(ultimateSkill))
        : undefined,
    }
  }

  /** Tr?ng thï¿½i turn-based hi?n t?i ï¿½ consumer n?i b? flip d?n sang dï¿½y. */
  getTurnBattle(): TurnBattle | null {
    return this.turnBattleOps.getTurnBattle()
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

  /** Bật/tắt manual mode. Tắt giữa lúc đang chờ choice → hủy pause, engine tự chạy tiếp. */
  setBattleManualMode(enabled: boolean): void {
    this.turnBattleOps.setBattleManualMode(enabled)
  }

  isBattleManualMode(): boolean {
    return this.turnBattleOps.presentationOps.isBattleManualMode()
  }

  /** Đang pause chờ player chọn skill cho lượt của chính mình? */
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

  /** Test/UI đọc token hiện tại của phase đang chờ (null nếu không pending). */
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

  /** Phaser gọi khi ready flourish xong → declare action, phát 'attack'. */
  acknowledgeTurnReady(token?: string): void {
    this.turnBattleOps.presentationOps.acknowledgeTurnReady(token)
  }

  /** Phaser gọi tại impact frame (lunge tween xong) → áp damage, phát VFX. */
  acknowledgeActionImpact(token?: string): void {
    this.turnBattleOps.presentationOps.acknowledgeActionImpact(token)
  }

  /** Phaser gọi khi VFX tween xong → turn cleanup, phát standby tail. */
  acknowledgeActionComplete(token?: string): void {
    this.turnBattleOps.presentationOps.acknowledgeActionComplete(token)
  }

  /**
   * UI submit choice cho lượt đang pause. Trả false nếu không có pause
   * (no-op an toàn — choice bị bỏ, không crash).
   */
  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    return this.turnBattleOps.submitTurnChoice(role)
  }

  /**
   * Dành cho UI: id của actor đang pause (luôn là 'player' ở engine hiện
   * tại — party nhiều người là redesign tương lai), null khi không pause.
   */
  consumeAwaitedActorId(): string | null {
    return this.turnBattleOps.presentationOps.consumeAwaitedActorId()
  }

  /**
   * Slice 7 — presentation facade: buildTurnSkillPresentation cho trận
   * turn hiện tại (isPlayerTurnPaused = manual pause đang chờ choice).
   * Party (Task 10): khi pause, presentation theo PAUSED ACTOR (bất kỳ
   * party member nào), không cố định players[0].
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
   * Tiện ích: bắt đầu trận đấu thẳng từ PlayerData thay vì phải
   * tự convert sang CombatEntity trước. `playerStats` truyền vào
   * phải là finalStats (đã cộng modifiers) — lấy từ
   * player store getter `finalStats`, không tính lại ở đây để
   * tránh 2 nơi tự gọi calculateStats() khác nhau.
   */
  startBattleWithPlayer(player: PlayerData, playerStats: Stats, enemy: Enemy) {
    this.turnBattleOps.startBattleWithPlayer(player, playerStats, enemy)
  }

  /**
   * getBattle() returns the TurnBattle (cast to the Battle shape its
   * read-only consumers expect: state/player/enemies). C1: the legacy
   * fallback branch is gone — null when no turn battle (tribulation side
   * never creates one).
   */
  getBattle(): Battle | null {
    return this.turnBattleOps.getBattle()
  }

  /**

    * ï¿½? Ki?p (spec dot-pha-loi-kiep ï¿½5.1) ï¿½ delegate xu?ng
    * TribulationDirector (runtime chuong ki?p m?i: tï¿½m ma + tank lï¿½i,
    * KHï¿½NG qua BattleSystem, khï¿½ng quï¿½i Ki?p). hasTrucCoDan d?c t?
    * PillBag (v?t ch?ng b?c ï¿½?a/Thiï¿½n, khï¿½ng tiï¿½u). B?t T? Th? khï¿½ng ï¿½p
    * trong ki?p (nghi l? th?t ï¿½ gi? pattern cu): ki?p khï¿½ng qua combat
    * nï¿½n khï¿½ng cï¿½ session nï¿½o d? xoï¿½.
    */

  startTribulation(
    player: PlayerData,
    playerStats: Stats,
    targetRealmId: string,
  ): boolean {
    const hasTrucCoDan = this.pillBag.has('truc_co_dan', 1)

    return this.tribulationDirector.start(player, playerStats, hasTrucCoDan, targetRealmId)
  }

  /**
   * Người chơi CHỦ ĐỘNG thoát trận giữa chừng (nút "Thoát Trận" ở
   * CombatControlBar.vue, có xác nhận trước khi gọi tới đây) — TÁI
   * DÙNG luồng 'defeat' sẵn có thay vì dựng 1 BattleState/UI mới:
   * chỉ set battle.state + emit 'battle_end' giống hệt
   * BattleSystem.checkBattleEnd() làm khi player chết.
   * updateStageProgress() TỰ dừng stageManager ở tick kế tiếp khi thấy
   * state 'defeat' (xem ghi chú ở đó) — không cần tự dọn gì thêm ở
   * đây. Phần thưởng đã kiếm được (grantBattleRewardIfNeeded() chạy
   * MỖI TICK theo từng quái chết, không đợi tới cuối trận) KHÔNG mất
   * dù thoát giữa chừng. Chỉ áp dụng trận Stage — Tribulation (Đột
   * Phá) có luồng thắng/thua RIÊNG (useTribulation.ts), nút "Thoát
   * Trận" không hiện trong trận đó (xem CombatControlBar.vue).
   */
  abandonBattle(): boolean {
    return this.turnBattleOps.abandonBattle()
  }

  /**
   * Vue layer (App.vue's tick()) gọi mỗi tick để rút toast phát sinh
   * TRONG core kể từ lần gọi trước — trả về rồi xoá hàng đợi.
   */
  drainNotifications(): NotificationEvent[] {
    return this.notifications.drain()
  }
}
