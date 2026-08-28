import { EventBus } from '../events/EventBus'

import { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'

import { BattleSystem } from '../battle/BattleSystem'
import type { Battle } from '../battle/Battle'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  isCombatAiStrategy,
  type CombatAiStrategy,
} from '../battle/CombatAiStrategy'

import type { FoundationType } from '../breakthrough/FoundationType'

import { investTinhHoa, computeBreakthroughGrade } from '../realm/BodyRefinementSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'
import { getAlchemySuccessBonusPercentPoints, getReactionKeepChance } from '../talent/TalentEffects'
import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'

import { BuffManager } from '../buff/BuffManager'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import type { Buff } from '../buff/Buff'

import { AilmentRegistry } from '../ailment/AilmentRegistry'
import type { AilmentTemplate } from '../ailment/AilmentRegistry'

import { NodeRegistry } from '../progression/NodeRegistry'
import type { ProgressionNode } from '../progression/ProgressionNode'
import {
  aggregateNodeSkillModifiers,
  aggregateNodeStatModifiers,
  canPurchaseNode as canPurchaseNodeSystem,
  canUpgradeNode as canUpgradeNodeSystem,
  devResetBranch as devResetBranchSystem,
  getNodeLevel as getNodeLevelSystem,
  getNextLevelCost as getNextLevelCostSystem,
  getNodeMaxLevel as getNodeMaxLevelSystem,
  purchaseNode as purchaseNodeSystem,
  upgradeNode as upgradeNodeSystem,
} from '../progression/NodeSystem'

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
import type { Material } from '../material/Material'

import { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import { EquipmentBag } from '../equipment/EquipmentBag'
import { EquipmentSystem } from '../equipment/EquipmentSystem'
import { createDefaultEquipmentOperationCostCatalog } from '../equipment/EquipmentOperationCostCatalog'
import { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { EquipmentSlotState } from '../equipment/EquipmentSlotState'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import { AffixRegistry } from '../equipment/AffixRegistry'
import type { Affix } from '../equipment/Affix'
import { assertValidEquipmentMainStats } from '../equipment/EquipmentStatPolicy'

import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { PillSystem } from '../pill/PillSystem'
import type { Pill } from '../pill/Pill'
import type { PillTarget } from '../pill/PillSystem'

import { TalismanRegistry } from '../talisman/TalismanRegistry'
import type { Talisman } from '../talisman/Talisman'

import { FormationRegistry } from '../formation/FormationRegistry'
import type { Formation } from '../formation/Formation'

import { ItemRegistry } from '../item/ItemRegistry'
import type { ItemGrade } from '../item/ItemGrade'

import { SUPPORTED_PROFESSION_REALMS } from '../profession/ProfessionMaterial'
import { validateProfessionMaterialEntry } from '../profession/ProfessionValidators'
import {
  SPIRIT_STONE_CONVERSION_RATIO,
  SPIRIT_STONE_MATERIAL_ID,
  getNextSpiritStoneMaterialId,
  getSpiritStoneMaterialIdForRealmTier,
} from '../material/SpiritStoneMaterial'
import {
  MATERIAL_TIER_CONVERSION_RATIO,
  getNextTierMaterialId,
} from '../material/MaterialTierConversionBalance'
import { getRealmTier } from '../realm/RealmTierMap'
import { calculateStats } from '../stats/StatCalculator'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import { EQUIPMENT_SLOTS } from '../equipment/EquipmentSlotState'

import { ProductionSystem, type ProductionSettlementEvent } from '../production/ProductionSystem'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_PRODUCTION_SITES,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_GROTTO_HERBS,
} from '../production/ProductionCatalog'
import type { ProductionSiteState } from '../production/ProductionTypes'
import {
  AlchemySystem,
  alchemySecondsFor,
  alchemyRoomSuccessBonus,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'
import { HERB_AGE_BASE_SUCCESS_PERCENT } from '../production/ProductionBalance'
import {
  DISSOLVE_ESSENCE_RANGE_BY_QUALITY,
  equipmentEssenceMaterialId,
} from '../equipment/RefinementBalance'

import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import type { Building } from '../building/Building'
import type { BuildingInstance } from '../building/BuildingInstance'
import type { CraftModifiers } from '../building/BuildingLevelEffect'

import { EnemyManager } from '../enemy/EnemyManager'
import { EnemySystem } from '../enemy/EnemySystem'
import { enemyToCombatEntity } from '../enemy/Enemy'
import type { Enemy } from '../enemy/Enemy'
import type { NotificationEvent } from '../notification/NotificationEvent'

import { StageManager } from '../stage/StageManager'
import { StageSystem } from '../stage/StageSystem'
import type { Stage } from '../stage/Stage'
import { ZoneRegistry } from '../stage/ZoneRegistry'
import type { Zone } from '../stage/Zone'

import { TemplateRegistry } from './TemplateRegistry'
import { NotificationQueue } from './NotificationQueue'
import { BattleLootSystem } from './BattleLootSystem'
import { StageWaveSystem } from './StageWaveSystem'
import { TribulationSystem } from './TribulationSystem'
import type { ActiveTribulation } from './TribulationSystem'

import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import type { QuestManagerState } from '../quest/QuestManager'
import { QuestSystem } from '../quest/QuestSystem'
import type { Quest } from '../quest/Quest'
import type { QuestProgress } from '../quest/QuestProgress'

// Re-export giữ tương thích import cũ (useTribulation.ts và các nơi khác
// import ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS từ GameManager).
export { TRIBULATION_COOLDOWN_SECONDS } from './TribulationSystem'
export type { ActiveTribulation } from './TribulationSystem'

import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import type { BattleRewardSummary } from '../reward/BattleRewardSummary'

import { playerToCombatEntity, createPlayerRewardReceiver } from '../player/Player'
import type { PlayerData } from '../player/Player'
import type { MainStatKey } from '../stats/StatTypes'
import { getMainStatCap } from '../stats/StatCap'
import { getTechniqueInsightTotalRequired, getTechniqueTier } from '../technique/TechniqueTier'
import { getSkillLoadoutSlotCount } from '../skill/SkillLoadoutSlots'
import { CULTIVATION_PATH_KITS } from '../player/CultivationPathKit'
import type { CultivationPathId } from '../player/CultivationPathKit'
import {
  getCultivationPathStatModifiers,
  grantCultivationPathRealmReward as grantPathRealmReward,
} from '../player/CultivationPathSystem'
import type { ArtifactPath } from '../artifact/Artifact'
import { tryUpgradeArtifactGrade } from '../artifact/ArtifactProgression'
import { createArtifactRuntime } from '../artifact/ArtifactRuntime'
import { filterNguHanhElements } from '../artifact/ArtifactSystem'

import { CORE_REALM_LEVEL, getCurrentRealm, getRealmIndex } from '../realm/realmSystem'
import { BREAKTHROUGH_REQUIREMENTS } from '../breakthrough/BreakthroughRequirement'

import type { GameSave } from '../../services/save/SaveSystem'

import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'

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
const BATTLE_FIXED_STEP_SECONDS = 0.1

// Giới hạn tổng thời gian được "đuổi kịp" cho mỗi lần update() — tránh
// hàng ngàn bước đồng bộ khoá UI sau khi máy ngủ/tab bị treo rất lâu.
// Phần deltaSeconds vượt ngưỡng này bị bỏ qua cho riêng nhánh combat/
// stage (coi như trận đấu "tạm dừng" trong khoảng đó) — các hệ thống
// khác (buff/cooldown/passive/formation ở update() bên dưới) vẫn nhận
// ĐỦ deltaSeconds thật vì chúng vốn đã an toàn với delta lớn.
const BATTLE_MAX_CATCHUP_SECONDS = 30

// Pháp Tu skill tree redesign (2026-08-21) — "Starter Skill KHÔNG nằm
// bên ngoài skill tree, nó CHÍNH LÀ root node của skill tree hành đó"
// (user spec). Không còn learnSkill() gọi trực tiếp ở đây nữa (đó là
// "auto-grant system riêng" mà spec cấm) — chooseCultivationPath() giờ
// mua node gốc của Hỏa (PHAP_TU_STARTER_NODE_ID, cost 0, xem
// data/progression/PhapTuNodes.ts's FIRE_LINH_NGO) qua ĐÚNG con đường
// purchaseNode() dùng chung với 4 hành còn lại (Thủy/Mộc/Thổ/Kim tốn 2
// Skill Point, người chơi tự mua node gốc của hành đó). Chỉ Hỏa được
// tự động mua sẵn (cost 0 = luôn đủ điểm); phần "trang bị vào slot 0"
// vẫn giữ riêng (equip khác học, xem SkillSystem.ts) vì Node Tree
// không mô tả khái niệm loadout slot.
const PHAP_TU_STARTER_NODE_ID = 'hoa_linh_ngo'
const PHAP_TU_STARTER_SKILL_ID = 'hoa_cau_thuat'

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

  readonly buffManager = new BuffManager()
  readonly buffSystem = new BuffSystem(this.buffManager)
  readonly buffRegistry = new BuffRegistry()

  readonly ailmentRegistry = new AilmentRegistry()

  readonly skillManager = new SkillManager()
  readonly skillSystem = new SkillSystem(this.skillManager, (skill, levelsGained) => {
    this.notifications.push({
      kind: 'upgrade',
      message:
        levelsGained === 1
          ? `${skill.name} đạt cấp ${skill.level}`
          : `${skill.name} tăng ${levelsGained} cấp, đạt cấp ${skill.level}`,
    })
  })
  readonly skillEffectSystem = new SkillEffectSystem()
  readonly passiveSystem = new PassiveSystem(this.eventBus, this.skillManager, this.skillSystem)

  // Pháp Tu Redesign (magicpath) — Node Tree, hạ tầng CHUNG cho mọi
  // path, xem core/progression/.
  readonly nodeRegistry = new NodeRegistry()

  registerProgressionNodes(nodes: ProgressionNode[]) {
    for (const node of nodes) {
      if (!this.nodeRegistry.has(node.id)) {
        this.nodeRegistry.register(node)
      }
    }
  }

  // Khai báo sau skillManager/skillSystem/skillEffectSystem/
  // buffRegistry vì field class khởi tạo theo thứ tự khai báo —
  // BattleSystem cần các field này đã có giá trị (basic skill
  // thay auto-attack + auto-cast, xem BattleSystem.ts).
  readonly battleSystem = new BattleSystem(
    this.combatSystem,
    this.skillManager,
    this.skillSystem,
    this.skillEffectSystem,
    this.buffRegistry,
    this.ailmentRegistry,
    this.eventBus,
    this.actionImpact,

    // Timed pill effects and socket modifiers remain live while the
    // restored 10×16 battle recomputes effective stats each tick.
    () => (this.activePlayer ? this.getActiveRuntimeModifiers(this.activePlayer) : []),

    // Combat AI strategy (plan §7/§10) — PlayerData là authority; đọc
    // LIVE để đổi strategy giữa trận có hiệu lực ngay trong tick kế.
    () => this.activePlayer?.combatAiStrategy ?? DEFAULT_COMBAT_AI_STRATEGY,

    // Thiên phú Phản Phác (talent-direction-choice-plan §6) — xác suất giữ
    // ailment khi kích Reaction, đọc LIVE từ activePlayer.
    () => getReactionKeepChance(this.activePlayer?.selectedTalentIds ?? []),
  )

  readonly techniqueManager = new TechniqueManager()
  readonly techniqueSystem = new TechniqueSystem(this.techniqueManager)

  readonly materialRegistry = new MaterialRegistry()
  readonly materialBag = new MaterialBag()

  readonly equipmentRegistry = new EquipmentRegistry()
  readonly equipmentBag = new EquipmentBag()
  readonly equipmentSystem = new EquipmentSystem(createDefaultEquipmentOperationCostCatalog())

  // Core Loop Foundation checklist (Phase 3, Mục AFFIX) — thay thế
  // hoàn toàn substatPool cũ.
  readonly affixRegistry = new AffixRegistry()

  // MASTER SPEC Mục XVI (Phase 9) — Cường Hóa sống ở đây (theo SLOT,
  // 6 slot cố định), tách khỏi EquipmentInstance.
  readonly equipmentSlotManager = new EquipmentSlotManager()

  readonly pillRegistry = new PillRegistry()
  readonly pillBag = new PillBag()
  readonly pillSystem = new PillSystem(this.buffSystem)

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
  // Ba service dưới đây sở hữu business logic trận đấu đang diễn ra:
  // - BattleLootSystem: loot/particle/toast/battle summary khi quái chết.
  // - StageWaveSystem: vòng đời wave của Màn + boss summon.
  // - TribulationSystem: runtime trận Độ Kiếp + cooldown.
  // Khởi tạo trong constructor (KHÔNG phải field initializer) vì cần
  // tham chiếu tới các field khai báo SAU chúng ở trên (bags/registries/
  // zoneRegistry/template registries) — field initializer chạy theo thứ
  // tự khai báo nên không thấy được; ctor body chạy sau cùng, an toàn.
  private readonly battleLoot: BattleLootSystem
  private readonly stageWaves: StageWaveSystem
  private readonly tribulation: TribulationSystem

  constructor() {
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
    })

    this.stageWaves = new StageWaveSystem({
      eventBus: this.eventBus,
      battleSystem: this.battleSystem,
      enemySystem: this.enemySystem,
      stageManager: this.stageManager,
      stageSystem: this.stageSystem,
      stageTemplates: this.stageTemplates,
      enemyTemplates: this.enemyTemplates,
      isStageUnlocked: (stageId, player) => this.isStageUnlocked(stageId, player),
      launchBattle: (player, playerStats, enemy) =>
        this.startBattleWithPlayer(player, playerStats, enemy),
    })

    this.tribulation = new TribulationSystem({
      eventBus: this.eventBus,
      battleSystem: this.battleSystem,
      combatSystem: this.combatSystem,
      buildPlayerSnapshot: (player, playerStats) => {
        const skillLevels = Object.fromEntries(
          this.skillManager.getAll().map((skill) => [skill.id, skill.level]),
        )

        return playerToCombatEntity(
          player,

          playerStats,

          this.getSkillRuntimeStats(player),

          skillLevels,
        )
      },
    })
  }

  /**
   * Skill runtime stats + node-derived skillModifiers (plan §6.8) —
   * thay đường mutate Skill instance lúc purchase: cộng flat/perLevel
   * suy ra từ (registry, nodeLevels) lên trên tổng hợp của SkillSystem.
   * Public cho UI/test; combat snapshot đi qua cùng đường này.
   */
  getSkillRuntimeStats(player: PlayerData) {
    const stats = this.skillSystem.getSkillRuntimeStats()

    for (const { statModifiers } of aggregateNodeSkillModifiers(this.nodeRegistry, player)) {
      for (const modifier of statModifiers) {
        stats[modifier.stat] += modifier.flat ?? 0
      }
    }

    return stats
  }

  // =========================
  // DATA REGISTRATION
  // =========================
  // Nạp dữ liệu tĩnh (từ /data) vào các Manager. Gọi 1 lần lúc
  // khởi tạo game. Tách riêng khỏi constructor để có thể gọi lại
  // trong test hoặc khi cần nạp thêm data theo DLC/patch sau này.

  registerMaterials(materials: Material[]) {
    // Boot validator (plan §4.1/§10 Phase 1): lỗi authoring dữ liệu nghề
    // fail NGAY khi đăng ký — không âm thầm tạo kinh tế hỏng. Chỉ validate
    // material CÓ meta nghề (legacy material không đụng); kiểm tra
    // PER-ENTRY (id convention + realm scope) — completeness toàn catalog
    // (đủ 3 rarity/cell) enforce ở ProfessionDataIntegrity.test trên
    // TOÀN BỘ mảng materials (registerMaterials có thể được gọi từng
    // phần trong test).
    for (const material of materials) {
      if (!material.profession) {
        continue
      }

      const error = validateProfessionMaterialEntry(material.id, material.profession)

      if (error) {
        throw new Error(`Profession material invalid: ${error}`)
      }
    }

    for (const material of materials) {
      if (!this.materialRegistry.has(material.id)) {
        this.materialRegistry.register(material)
      }
    }
  }

  registerBuffs(buffs: Buff[]) {
    for (const buff of buffs) {
      if (!this.buffRegistry.has(buff.id)) {
        this.buffRegistry.register(buff)
      }
    }
  }

  registerAilments(ailments: AilmentTemplate[]) {
    for (const ailment of ailments) {
      if (!this.ailmentRegistry.has(ailment.id)) {
        this.ailmentRegistry.register(ailment)
      }
    }
  }

  registerBuildings(items: Building[]) {
    for (const item of items) {
      if (!this.buildingRegistry.has(item.id)) {
        this.buildingRegistry.register(item)
      }
    }
  }

  registerQuests(quests: Quest[]) {
    for (const quest of quests) {
      if (!this.questRegistry.has(quest.id)) {
        this.questRegistry.register(quest)
      }
    }
  }

  /** Đăng ký đan phương (plan §8) — validate mapping thảo duy nhất. */
  registerAlchemyRecipes(recipes: AlchemyRecipe[]) {
    for (const recipe of recipes) {
      if (this.alchemyRecipesById.has(recipe.id)) {
        throw new Error(`Alchemy recipe already registered: ${recipe.id}`)
      }

      const herbBases = new Set(
        recipe.herbVariants.map((variant) => variant.materialId.split('_')[0]),
      )

      if (
        herbBases.size > 1 &&
        new Set(recipe.herbVariants.map((v) => v.materialId)).size !== recipe.herbVariants.length
      ) {
        throw new Error(`Alchemy recipe ${recipe.id}: herb variants trùng lặp`)
      }

      this.alchemyRecipesById.set(recipe.id, recipe)
    }

    this.alchemySystem.setRecipeLookup((recipeId) => this.alchemyRecipesById.get(recipeId))
  }

  registerEquipment(items: Equipment[]) {
    for (const item of items) {
      assertValidEquipmentMainStats(item)

      if (!this.equipmentRegistry.has(item.id)) {
        this.equipmentRegistry.register(item)
      }
    }
  }

  registerAffixes(items: Affix[]) {
    for (const item of items) {
      if (!this.affixRegistry.has(item.id)) {
        this.affixRegistry.register(item)
      }
    }
  }

  registerPills(pills: Pill[]) {
    for (const pill of pills) {
      if (!this.pillRegistry.has(pill.id)) {
        this.pillRegistry.register(pill)
      }
    }
  }

  registerFormations(formations: Formation[]) {
    // Tombstone-only (plan §10.1.4).
    for (const formation of formations) {
      if (!this.formationRegistry.has(formation.id)) {
        this.formationRegistry.register(formation)
      }
    }
  }

  registerTalismans(talismans: Talisman[]) {
    // Tombstone-only (plan §10.1.4) — đăng ký để save cũ load không
    // crash, KHÔNG tạo nguồn mới.
    for (const talisman of talismans) {
      if (!this.talismanRegistry.has(talisman.id)) {
        this.talismanRegistry.register(talisman)
      }
    }
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

  registerZones(zones: Zone[]) {
    for (const zone of zones) {
      this.zoneRegistry.register(zone)
    }
  }

  registerSkillTemplates(skills: Skill[]) {
    for (const skill of skills) {
      this.skillTemplates.register(skill.id, skill)
    }
  }

  registerTechniqueTemplates(techniques: Technique[]) {
    for (const technique of techniques) {
      this.techniqueTemplates.register(technique.id, technique)
    }
  }

  registerEnemyTemplates(enemies: Enemy[]) {
    for (const enemy of enemies) {
      this.enemyTemplates.register(enemy.id, enemy)
    }
  }

  registerStages(stages: Stage[]) {
    for (const stage of stages) {
      this.stageTemplates.register(stage.id, stage)
    }
  }

  getStage(stageId: string): Stage | undefined {
    return this.stageTemplates.get(stageId)
  }

  /**
   * Tự Động Thám Hiểm (mode 'auto', xem stores/ui.ts) — Màn kế tiếp
   * trong CÙNG Địa Giới với `currentStageId`, theo đúng thứ tự khai
   * trong `Zone.stageIds`. Trả về null nếu đã ở Màn cuối hoặc
   * currentStageId không thuộc zone này — caller (App.vue's
   * fightStage()) tự fallback lặp lại Màn hiện tại khi null (graceful,
   * không cần biết trước zone có bao nhiêu Màn).
   */
  getNextStageInZone(zoneId: string, currentStageId: string): string | null {
    if (!this.zoneRegistry.has(zoneId)) {
      return null
    }

    const zone = this.zoneRegistry.get(zoneId)

    const index = zone.stageIds.indexOf(currentStageId)

    if (index === -1) {
      return null
    }

    return zone.stageIds[index + 1] ?? null
  }

  isStageUnlocked(stageId: string, player: PlayerData): boolean {
    const stage = this.stageTemplates.get(stageId)

    if (stage?.requiredRealmId) {
      const requiredRealmIndex = getRealmIndex(stage.requiredRealmId)
      const playerRealmIndex = getRealmIndex(player.realmId)

      if (playerRealmIndex < requiredRealmIndex) {
        return false
      }

      if (
        playerRealmIndex === requiredRealmIndex &&
        stage.requiredRealmLevel !== undefined &&
        player.realmLevel < stage.requiredRealmLevel
      ) {
        return false
      }
    }

    const zones = this.zoneRegistry.getAll()
    const zoneIndex = zones.findIndex((candidate) => candidate.stageIds.includes(stageId))
    const zone = zones[zoneIndex]

    if (!zone) {
      // Stage độc lập (Độ Kiếp/test/debug) không thuộc tuyến thám hiểm.
      return true
    }

    const index = zone.stageIds.indexOf(stageId)

    if (index > 0) {
      return player.completedStageIds.includes(zone.stageIds[index - 1]!)
    }

    if (zoneIndex === 0) {
      return true
    }

    const previousZone = zones[zoneIndex - 1]!
    const previousFinalStage = previousZone.stageIds.at(-1)
    return Boolean(previousFinalStage && player.completedStageIds.includes(previousFinalStage))
  }

  learnSkill(skillId: string): boolean {
    const template = this.skillTemplates.get(skillId)

    if (!template) {
      return false
    }

    return this.skillSystem.learn(template)
  }

  /**
   * Pháp Tu Redesign (magicpath) — mua 1 ProgressionNode (LĨNH NGỘ,
   * 0→1). Gọi `purchaseNode()` thuần (core/progression/NodeSystem.ts)
   * trước — hàm đó tự xử lý mọi thứ không cần registry. Chỉ còn
   * `unlocksSkillIds` cần learnSkill() (cần skillTemplates, GameManager
   * mới có). KHÔNG tự equip skill vừa unlock.
   *
   * §6.8 — KHÔNG còn mutate Skill instance / push player.modifiers lúc
   * mua: mọi hiệu lực suy ra từ (registry, nodeLevels) qua aggregator
   * (getAggregatedModifiers + buildSkillRuntimeStats), recompute luôn
   * cho cùng kết quả xác định.
   */
  purchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.nodeRegistry.has(nodeId)) {
      return false
    }

    const node = this.nodeRegistry.get(nodeId)

    if (!purchaseNodeSystem(player, node)) {
      return false
    }

    // Effect mở khoá skill chỉ chạy ở chuyển tiếp 0 → 1 —
    // purchaseNodeSystem chỉ trả true đúng ở chuyển tiếp này.
    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId)
    }

    return true
  }

  /** Cấp reward đại cảnh giới theo cultivation path từ data kit. */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId, {
      getEquippedTechnique: () => this.techniqueManager.getEquipped(),
      getTechnique: techniqueId => this.techniqueManager.get(techniqueId),
      learnTechnique: techniqueId => this.learnTechnique(techniqueId),
      equipTechnique: techniqueId => this.equipTechnique(techniqueId),
    })
  }

  /**
   * Nâng node đã lĩnh ngộ lên +1 cấp bằng Cảm Ngộ (§6.2) — cost theo
   * data node; không vượt maxLevel; thất bại không mutate gì.
   */
  upgradeNode(nodeId: string, player: PlayerData): boolean {
    if (!this.nodeRegistry.has(nodeId)) {
      return false
    }

    return upgradeNodeSystem(player, this.nodeRegistry.get(nodeId))
  }

  getNodeLevel(nodeId: string, player: PlayerData): number {
    return this.nodeRegistry.has(nodeId) ? getNodeLevelSystem(player, nodeId) : 0
  }

  getNodeMaxLevel(nodeId: string): number {
    return this.nodeRegistry.has(nodeId) ? getNodeMaxLevelSystem(this.nodeRegistry.get(nodeId)) : 0
  }

  /** Cost Cảm Ngộ của lần mua/nâng KẾ TIẾP — undefined khi đã max. */
  getNextNodeCost(nodeId: string, player: PlayerData): number | undefined {
    if (!this.nodeRegistry.has(nodeId)) {
      return undefined
    }

    const node = this.nodeRegistry.get(nodeId)

    const level = getNodeLevelSystem(player, nodeId)

    if (level >= getNodeMaxLevelSystem(node)) {
      return undefined
    }

    return getNextLevelCostSystem(node, level)
  }

  canPurchaseNode(nodeId: string, player: PlayerData): boolean {
    return (
      this.nodeRegistry.has(nodeId) && canPurchaseNodeSystem(player, this.nodeRegistry.get(nodeId))
    )
  }

  canUpgradeNode(nodeId: string, player: PlayerData): boolean {
    return (
      this.nodeRegistry.has(nodeId) && canUpgradeNodeSystem(player, this.nodeRegistry.get(nodeId))
    )
  }

  /**
   * Reset development một nhánh (§6.10) — hoàn đúng tổng Cảm Ngộ đã
   * tiêu (suy từ level/cost data), cascade gỡ node con mồ côi; modifier
   * tự cập nhật qua aggregator (không trừ ngược modifier cũ).
   */
  devResetBranch(branchTag: string, player: PlayerData): number {
    return devResetBranchSystem(player, this.nodeRegistry, branchTag)
  }

  /**
   * skill-insight-and-auto-combat-hud-plan.md mục 5 — nâng cấp skill
   * bằng Cảm ngộ Kỹ năng, thuần pass-through xuống SkillSystem (đã có
   * skillManager qua constructor, không cần gì thêm từ GameManager).
   */
  upgradeSkill(skillId: string, player: PlayerData): boolean {
    return this.skillSystem.upgradeSkill(skillId, player)
  }

  getSkillUpgradeInsightCost(skillId: string): number | undefined {
    return this.skillSystem.getSkillUpgradeInsightCost(skillId)
  }

  /**
   * PLAN HOÀN CHỈNH mục 2 — tiêu 1 attributePoint vào ĐÚNG 1 Main Stat.
   * No-op (trả false) nếu hết điểm hoặc stat đã chạm trần đại cảnh
   * giới hiện tại (getMainStatCap()) — trần tính riêng từng stat,
   * KHÔNG có trần tổng của cả 5 (đúng "Nguyên tắc" mục 2 của doc).
   */
  allocateAttributePoint(player: PlayerData, stat: MainStatKey): boolean {
    if (player.attributePoints <= 0) {
      return false
    }

    if (player.baseStats[stat] >= getMainStatCap(player.realmId)) {
      return false
    }

    player.attributePoints--
    player.baseStats[stat]++

    return true
  }

  learnTechnique(techniqueId: string): boolean {
    const template = this.techniqueTemplates.get(techniqueId)

    if (!template) {
      return false
    }

    return this.techniqueSystem.learn(template)
  }

  /**
   * Tâm Pháp Chiến Đấu có thể mang `innateSkillId` (nội tại chiến đấu
   * đặc trưng) — tự học + equip skill passive đó ngay khi tâm pháp
   * được trang bị, pattern Y HỆT syncRealmPassive() (idempotent qua
   * skillManager.has(), un-equip technique sau đó KHÔNG tự gỡ skill —
   * giữ tinh thần "học rồi thì giữ" toàn hệ thống).
   */
  equipTechnique(techniqueId: string): boolean {
    const success = this.techniqueSystem.equip(techniqueId)

    if (!success) {
      return false
    }

    const technique = this.techniqueManager.get(techniqueId)

    if (technique?.innateSkillId && !this.skillManager.has(technique.innateSkillId)) {
      const template = this.skillTemplates.get(technique.innateSkillId)

      if (template) {
        this.skillSystem.learn(template)

        // innateSkillId luôn là passive (xem Technique.ts) — không
        // thuộc Skill Loadout, dùng equipWithoutSlot() như mọi passive
        // khác (syncRealmPassive()).
        this.skillSystem.equipWithoutSlot(technique.innateSkillId)
      }
    }

    return true
  }

  unequipTechnique(techniqueId: string): boolean {
    return this.techniqueSystem.unequip(techniqueId)
  }

  /**
   * Pháp Tu profession-tier ladder (2026-08-14, hợp nhất Tâm Pháp
   * 2026-08-15) — "chọn nghề nghiệp", MỘT LẦN DUY NHẤT, VĨNH VIỄN (xem
   * PlayerData.cultivationPath) — tự cấp ĐÚNG bộ kit cố định của tier
   * đó: 1 Tâm Pháp hợp nhất (GHI ĐÈ tâm pháp đang trang bị, kể cả tâm
   * pháp khởi đầu) + 3 skill cố định (basic/special/ultimate, GHI ĐÈ
   * bất kỳ skill nào đang chiếm 3 slot đó). KHÔNG phải hệ thống build
   * tự do — tái dùng nguyên vẹn learnTechnique()/equipTechnique()/
   * learnSkill()/equipSkill() đã có.
   *
   * Nghi Lễ Nhập Môn (2026-08-16) — chọn path CHÍNH LÀ nghi lễ đột phá
   * Phàm Nhân -> Luyện Khí (đúng "đột phá lên cảnh giới mới luôn có
   * nghi lễ" — Trúc Cơ có Độ Kiếp riêng, Phàm Nhân->Luyện Khí dùng
   * chính hành động chọn nghề này thay vì 1 nút Đột Phá thường, xem
   * CultivationSystem.breakthrough()'s guard chặn realmId === 'mortal').
   * Nếu player đang ở Phàm Nhân lúc chọn, atomically chuyển luôn sang
   * qi_refining tầng 1 — 3 hàm gọi sau đó GIỐNG HỆT useBreakthrough.ts/
   * useTribulation.ts gọi sau mọi lần đột phá đại cảnh giới.
   */
  chooseCultivationPath(pathId: CultivationPathId, player: PlayerData): boolean {
    if (
      player.cultivationPath ||
      player.realmId !== 'mortal' ||
      player.realmLevel < CORE_REALM_LEVEL
    ) {
      return false
    }

    const kit = CULTIVATION_PATH_KITS[pathId]

    player.cultivationPath = pathId

    this.learnTechnique(kit.techniqueId)
    this.equipTechnique(kit.techniqueId)

    // Pháp Tu Redesign — kit.skillIds giờ optional (chỉ Kiếm Tu còn
    // khai cố định).
    //
    // PLAN HOÀN CHỈNH mục 8 — gán THẲNG vào slot 0/1/2 theo đúng thứ tự
    // tuple [basic, special, ultimate] của kit, BỎ QUA validate
    // getSkillLoadoutSlotCount() (setSkillLoadoutSlot() dưới đây có gate
    // đó cho hành động CỦA NGƯỜI CHƠI — đây là kit HỆ THỐNG cấp sẵn lúc
    // nhập môn, phải có đủ chỗ ngay cả khi Luyện Khí mới mở 2/5 ô; ô
    // 3 tồn tại sẵn trong dữ liệu, chỉ đơn giản chưa lộ ra UI cho tới
    // khi đủ cảnh giới).
    if (kit.skillIds) {
      kit.skillIds.forEach((skillId, index) => {
        this.learnSkill(skillId)
        this.skillSystem.equipToSlot(skillId, index)
      })
    } else {
      // Skill tree redesign (2026-08-21) — Hỏa Cầu Thuật là ROOT NODE
      // của Hỏa skill tree (không phải 1 skill học riêng bên ngoài cây),
      // xem data/progression/PhapTuNodes.ts's FIRE_LINH_NGO — cost 0 nên
      // luôn mua được ngay, purchaseNode() tự lo learnSkill() qua
      // unlocksSkillIds. Sau đó trang bị NGAY vào slot 0, thay vì bắt
      // người chơi tự mở Node Tree + Radial Skill Selector trước khi
      // đánh được trận nào. equipToSlot() tự dời skill đang chiếm slot 0
      // (Trảm của Phàm Nhân) — execution policy rework (plan §8.6) không
      // còn mutual-exclusion đòn cơ bản riêng. Vì luôn có skill ngay
      // sau bước này, gate blockIfNoBasicAttack() ở useBattleActions.ts/
      // useTribulation.ts đã GỠ theo (không còn tình huống "chưa trang bị
      // gì" nữa). Thủy/Mộc/Thổ/Kim KHÔNG tự mua — root node của 4 hành
      // đó tốn 2 Skill Point, người chơi tự mua qua Node Tree UI.
      this.purchaseNode(PHAP_TU_STARTER_NODE_ID, player)

      this.skillSystem.equipToSlot(PHAP_TU_STARTER_SKILL_ID, 0)
    }

    if (player.realmId === 'mortal') {
      // Realm Passive & Pressure System (2026-08-20) — chốt Bậc Nhập
      // Đạo TRƯỚC khi grant, để Nhập Đạo (RealmPassives.ts) đọc đúng
      // giá trị cuối cùng của Luyện Thể tại thời điểm Lễ Nhập Môn.
      player.breakthroughGrade = computeBreakthroughGrade(player)

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      this.syncRealmPassive(player)
      this.syncRealmStatPassive(player)
    }

    return true
  }

  /**
   * Bản Mệnh Pháp Bảo (doc §7.1) — chọn/đổi hướng Công/Thủ/Khống. Đổi
   * được NHIỀU LẦN ngoài combat (khác chooseCultivationPath() ở trên —
   * đó là lựa chọn vĩnh viễn, đây là "đổi miễn phí ngoài combat để
   * test"). Giữ nguyên EXP/tầng/phẩm, chỉ áp dụng từ trận kế (runtime
   * artifact snapshot path lúc Battle bắt đầu, không đọc lại giữa trận).
   * KHÔNG dùng window.confirm — khác QuanKhiPanel.vue (lựa chọn đó
   * không thể đổi lại, đây thì có).
   */
  setArtifactPath(player: PlayerData, path: ArtifactPath): boolean {
    if (!player.artifact) {
      return false
    }

    const battle = this.getBattle()

    if (battle && (battle.state === 'countdown' || battle.state === 'fighting' || battle.mode === 'tribulation')) {
      return false
    }

    player.artifact.selectedPath = path

    return true
  }

  /**
   * Bản Mệnh Pháp Bảo (doc §5.3) — nâng phẩm bằng Đoán Bảo Thạch, CHỈ
   * ngoài combat (transaction thật nằm ở tryUpgradeArtifactGrade() core
   * thuần — enforce guard combat NGAY TẠI ĐÂY, không chỉ ở UI).
   */
  tryUpgradeArtifactGrade(player: PlayerData): boolean {
    if (!player.artifact) {
      return false
    }

    const battle = this.getBattle()

    if (battle && (battle.state === 'countdown' || battle.state === 'fighting' || battle.mode === 'tribulation')) {
      return false
    }

    return tryUpgradeArtifactGrade(player.artifact, this.materialBag)
  }

  /**
   * PLAN HOÀN CHỈNH mục 8/12 — "Set Skill vào Loadout" (Tầng 4), tách
   * biệt HOÀN TOÀN khỏi learnSkill()/purchaseNode() (Tầng 3, "học").
   * skillId === null thì DỌN slot đó (unequip skill đang chiếm, nếu
   * có). Validate slotIndex theo tiến trình cảnh giới ở ĐÂY (không
   * phải SkillSystem — domain thuần không biết realm).
   */
  setSkillLoadoutSlot(player: PlayerData, slotIndex: number, skillId: string | null): boolean {
    if (skillId === null) {
      const current = this.skillManager.getEquippedInSlot(slotIndex)

      return current ? this.skillSystem.unequipFromSlot(slotIndex) : false
    }

    if (slotIndex < 0 || slotIndex >= getSkillLoadoutSlotCount(player.realmId)) {
      return false
    }

    if (!this.skillManager.has(skillId) || !this.skillManager.get(skillId)!.unlocked) {
      return false
    }

    return this.skillSystem.equipToSlot(skillId, slotIndex)
  }

  unequipSkill(skillId: string): boolean {
    return this.skillSystem.unequip(skillId)
  }

  /**
   * Combat AI strategy (plan §10) — PlayerData là nguồn sự thật duy nhất;
   * UI không tự giữ state. Validate qua isCombatAiStrategy() dùng chung,
   * trả false nếu giá trị sai. Lưu tự kích hoạt qua save scheduling hiện
   * có (autosave/visibilitychange) sau khi UI bumpState().
   */
  setCombatAiStrategy(player: PlayerData, strategy: CombatAiStrategy): boolean {
    if (!isCombatAiStrategy(strategy)) {
      return false
    }

    player.combatAiStrategy = strategy

    return true
  }

  // Core Loop Foundation checklist (Mục SKILL) — "behavior-changing
  // node".
  selectSkillSpecialization(skillId: string, specializationId: string): boolean {
    return this.skillSystem.selectSpecialization(skillId, specializationId)
  }

  // =========================
  // MODIFIER AGGREGATION
  // =========================

  /**
   * Modifier tổng hợp từ Buff + Technique đang trang bị + Skill
   * passive đang equipped. Stack của passiveModifiers được
   * PassiveSystem tích trực tiếp lên object Skill (xem
   * PassiveSystem.ts) nên chỉ cần đọc thẳng từ skillManager, không
   * cần một bước "gộp" riêng như trước đây comment cũ nhắc tới.
   *
   * Đây là điểm duy nhất trong toàn bộ game tổng hợp modifier
   * theo thời gian thực. player.ts (store) chỉ cần gọi hàm này
   * mỗi tick thay vì tự đi gộp từ buffSystem/techniqueSystem/skillManager.
   */
  /**
   * `player` optional (mặc định bỏ qua tier tâm pháp) — nhiều call site
   * cũ (test files, vài panel refresh phụ) gọi hàm này KHÔNG có sẵn
   * PlayerData tiện tay; chữ ký cũ vẫn hợp lệ nguyên vẹn. Call site
   * "thật" mỗi tick (App.vue) LUÔN truyền player để tier tâm pháp có
   * hiệu lực — xem getTechniqueTierModifiers().
   */
  getAggregatedModifiers(player?: PlayerData): StatModifier[] {
    // STATIC-ONLY (2026-08-24, plan §5.4): timed effect + socket
    // Phù/Trận là modifier SỐNG — KHÔNG nằm ở đây để finalStats caller
    // truyền vào battle là snapshot tĩnh sạch (không double-apply);
    // combat recompute nhận runtime qua provider mỗi tick, menu hiển thị
    // qua store getter cộng getActiveRuntimeModifiers().
    return [
      ...this.buffSystem.getActiveModifiers(),
      // Core Loop Foundation checklist (Mục SKILL) - qua
      // getScaledPassiveModifiers() thay vì đọc thẳng
      // skill.passiveModifiers, để áp Specialization + level scaling.
      ...this.skillSystem.getScaledPassiveModifiers(),
      ...(player ? this.getTechniqueTierModifiers(player) : []),
      ...(player ? getCultivationPathStatModifiers(player) : []),
      // Node level (plan §6.8) — modifier node suy ra từ (registry,
      // nodeLevels), scale theo level hiện hành; KHÔNG nằm trong
      // player.modifiers nữa.
      ...(player ? aggregateNodeStatModifiers(this.nodeRegistry, player) : []),
      // Combat-gate-teleport-autocast plan §9 — combatModifiers của tâm
      // pháp ĐANG trang bị (+2 attackRange Đại Ngũ Hành Chân Quyết):
      // cố định, không theo tier, chỉ khi equipped. DUY NHẤT đường tổng
      // hợp để tránh cộng hai lần.
      ...this.getTechniqueCombatModifiers(),
    ]
  }

  /** Modifier combat cố định của tâm pháp đang trang bị (plan §9). */
  private getTechniqueCombatModifiers(): StatModifier[] {
    const technique = this.techniqueManager.getEquipped()

    if (!technique?.equipped || !technique.combatModifiers) {
      return []
    }

    return [...technique.combatModifiers]
  }

  /**
   * PLAN HOÀN CHỈNH mục 5 rework (2026-08-20) — hiệu ứng chỉ số của tâm
   * pháp ĐANG trang bị, theo ĐÚNG tier hiện tại (getTechniqueTier(),
   * giờ tính từ techniqueExperience — thanh kinh nghiệm riêng của Tâm
   * Pháp, xem TechniqueTier.ts). manaRegenPercent cố ý map vào percent
   * CỦA stat manaRegenPerSecond (Increased chuẩn, xem StatCalculator.ts's
   * runPipeline) thay vì %maxMp — %maxMp sẽ tạo phụ thuộc vòng (maxMp
   * chưa tính xong ngay tại bước gộp modifier này).
   */
  // =========================
  // RUNTIME MODIFIER AUTHORITY (2026-08-24, resource-professions-rework
  // Phase 4/6 — plan §5.4/§7.2): modifier SỐNG theo thời gian (timed
  // effect) + modifier socket trên slot (Phù/Trận). MỘT authority duy
  // nhất ở đây — menu (getAggregatedModifiers) và combat recompute
  // (BattleSystem qua provider) cùng đọc, không hai bản sao lệch nhau.
  // KHÔNG bao giờ vào CombatEntity.baseStats snapshot.
  // =========================

  private activePlayer?: PlayerData

  /**
   * App.vue đăng ký player sau boot/load — update() dùng để tick expiry
   * timed effect theo Date.now().
   */
  setActivePlayer(player: PlayerData) {
    this.activePlayer = player

    // Load save: bỏ effect đã hết hạn ngay (plan §9).
    this.tickTimedEffects(player)
  }

  getActiveTimedModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > now)
      .flatMap((effect) => effect.modifiers)
  }

  /**
   * Toàn bộ modifier SỐNG của player: timed effect + socket Phù/Trận
   * trên slot đang có equipment. Battle recompute gọi qua provider mỗi
   * tick — effect hết hạn giữa trận tự rơi khỏi recompute kế tiếp.
   */
  getActiveRuntimeModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return [...this.getActiveTimedModifiers(player, now), ...this.getSlotModifiers()]
  }

  /**
   * Stack policy MVP (plan §5.4): cùng effectGroup → refresh deadline
   * (max) và giữ giá trị mạnh hơn per-modifier; khác nhóm → thêm mới.
   *
   * Merge key theo IDENTITY THỰC của modifier: `stat` + `tag` (tag phân
   * biệt pool Increased trong runPipeline(), xem StatCalculator) — KHÔNG
   * dùng giá trị `percent` làm key (bug audit P0-1: hai percent khác nhau
   * của cùng stat không match và cộng dồn ngoài policy). Khi match, chọn
   * giá trị mạnh hơn RIÊNG cho flat/percent/multiplier để modifier yếu và
   * mạnh không cùng tồn tại.
   */
  applyTimedEffect(player: PlayerData, effect: PersistentTimedEffect) {
    const group = effect.effectGroup

    if (group) {
      const existing = player.persistentTimedEffects.find(
        (candidate) => candidate.effectGroup === group,
      )

      if (existing) {
        if (effect.durationStackable) {
          const duration = Math.max(0, effect.expiresAtMs - effect.appliedAtMs)
          existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration
        } else {
          existing.expiresAtMs = Math.max(existing.expiresAtMs, effect.expiresAtMs)
        }

        for (const modifier of effect.modifiers) {
          const old = existing.modifiers.find(
            (candidate) => candidate.stat === modifier.stat && candidate.tag === modifier.tag,
          )

          if (!old) {
            existing.modifiers.push(modifier)

            continue
          }

          if ((modifier.flat ?? 0) > (old.flat ?? 0)) {
            old.flat = modifier.flat
          }

          if ((modifier.percent ?? 0) > (old.percent ?? 0)) {
            old.percent = modifier.percent
          }

          if ((modifier.multiplier ?? 1) > (old.multiplier ?? 1)) {
            old.multiplier = modifier.multiplier
          }
        }

        return
      }
    }

    player.persistentTimedEffects.push(effect)
  }

  /** Bỏ effect hết hạn — trả số effect đã rơi (debug/test). */
  tickTimedEffects(player: PlayerData, now = Date.now()): number {
    const before = player.persistentTimedEffects.length

    player.persistentTimedEffects = player.persistentTimedEffects.filter(
      (effect) => effect.expiresAtMs > now,
    )

    return before - player.persistentTimedEffects.length
  }

  /**
   * Nguồn DUY NHẤT tổng hợp 2+2 modifier Phù/Trận trên các slot đang có
   * equipment (plan §7.2). Socket modifier giữ sourceId/sourceType ổn
   * định để tooltip/debug truy nguồn, KHÔNG vào baseStats snapshot.
   */
  getSlotModifiers(): StatModifier[] {
    const result: StatModifier[] = []

    for (const slot of EQUIPMENT_SLOTS) {
      if (!this.equipmentBag.getEquippedInSlot(slot)) {
        continue
      }

      const state = this.equipmentSlotManager.get(slot)

      if (state.socketedTalisman) {
        result.push(...state.socketedTalisman.modifiers)
      }

      if (state.socketedFormation) {
        result.push(...state.socketedFormation.modifiers)
      }
    }

    return result
  }

  private getTechniqueTierModifiers(player: PlayerData): StatModifier[] {
    const technique = this.techniqueManager.getEquipped()

    const effect =
      technique?.tierEffects?.[
        getTechniqueTier(technique.insight ?? 0, getTechniqueInsightTotalRequired(technique))
      ]

    if (!effect) {
      return []
    }

    const modifiers: StatModifier[] = []

    if (effect.attackFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:attack`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'attack',
        flat: effect.attackFlat,
      })
    }

    if (effect.defenseFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:defense`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'defense',
        flat: effect.defenseFlat,
      })
    }

    if (effect.maxMpPercent !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:maxMp`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'maxMp',
        percent: effect.maxMpPercent,
      })
    }

    if (effect.manaRegenPercent !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:manaRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'manaRegenPerSecond',
        percent: effect.manaRegenPercent,
      })
    }

    // Yêu cầu 2026-08-26 — HP/s & MP/s mặc định của tâm pháp: flat trực
    // tiếp lên 2 stat hồi/giây, áp cho MỌI technique khai tierEffects.
    if (effect.hpRegenFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:hpRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'hpRegenPerSecond',
        flat: effect.hpRegenFlat,
      })
    }

    if (effect.mpRegenFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:mpRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'manaRegenPerSecond',
        flat: effect.mpRegenFlat,
      })
    }

    return modifiers
  }

  /**
   * Mở khóa + tự equip passive skill ứng với cảnh giới hiện tại của
   * player — gọi ngay sau breakthrough() thành công. Nguồn passive
   * giờ đến từ tâm pháp ĐANG trang bị (Technique.passiveSkillIdsByRealm,
   * hợp nhất 2026-08-15 — không còn slot 'cultivation' riêng), không
   * còn cố định theo cảnh giới (RealmData.unlockSkillId cũ) — đổi tâm
   * pháp thì 9 passive tương lai cũng đổi theo, passive đã học trước
   * đó thì giữ nguyên. Không có tâm pháp nào đang trang bị thì không
   * có passive nào được học. Idempotent (kiểm tra skillManager.has()
   * trước khi learn) nên an toàn khi gọi lặp hoặc sau khi load save.
   */
  syncRealmPassive(player: PlayerData) {
    const realm = getCurrentRealm(player.realmId)

    const technique = this.techniqueManager.getEquipped()

    const skillId = technique?.passiveSkillIdsByRealm?.[realm.id]

    if (!skillId) {
      return
    }

    if (this.skillManager.has(skillId)) {
      return
    }

    const template = this.skillTemplates.get(skillId)

    if (!template) {
      return
    }

    this.skillSystem.learn(template)

    // Passive KHÔNG thuộc Skill Loadout (không tranh slot với active
    // skill) — equipWithoutSlot() y hệt hành vi equip() cũ cho passive.
    this.skillSystem.equipWithoutSlot(skillId)
  }

  /**
   * Realm Passive & Pressure System (2026-08-20) — cấp buff VĨNH VIỄN
   * (Nhập Đạo/Kiến Cơ/..., xem data/realm/RealmPassives.ts) của cảnh
   * giới HIỆN TẠI, tên tách biệt syncRealmPassive() ở trên (đó là
   * passive SKILL theo tâm pháp, đây là stat modifier theo Breakthrough
   * Grade/Loại Trúc Cơ) để khỏi nhầm 2 khái niệm. Idempotent (xem
   * RealmPassiveSystem.grantRealmPassive()) — gọi cùng 3 điểm với
   * syncRealmPassive() (chooseCultivationPath() dưới đây,
   * useBreakthrough.ts, useTribulation.ts's resolveVictory()).
   */
  syncRealmStatPassive(player: PlayerData) {
    grantRealmPassive(player, getCurrentRealm(player.realmId).id)
  }

  /**
   * Đầu tư Tinh Hoa Phàm Thể (đang cầm trong materialBag) vào tầng
   * Luyện Thể đang dở — xem core/realm/BodyRefinementSystem.ts. Trả về số
   * Tinh Hoa thật sự đã tiêu (0 nếu không còn tầng nào để đầu tư hoặc
   * không cầm Tinh Hoa nào).
   */
  investBodyRefinement(player: PlayerData): number {
    const available = this.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)

    const consumed = investTinhHoa(player, available)

    if (consumed > 0) {
      this.materialBag.remove(TINH_HOA_PHAM_THE_MATERIAL_ID, consumed)
    }

    return consumed
  }

  /**
   * Đột Phá Trúc Cơ: mốc tối thiểu để nút "TRÚC CƠ" xuất hiện song song
   * nút "Đột Phá" thường. Thiết kế hiện tại (2026-08-27): mốc 12 tầng ở
   * qi_refining là Nhân Đạo baseline; các cấp đột phá ẩn khác sẽ được
   * thiết kế sau, cùng hằng số với mortal → qi_refining
   * (chooseCultivationPath()).
   */
  canTriggerFoundationBreakthrough(player: PlayerData): boolean {
    return player.realmId === 'qi_refining' && player.realmLevel >= CORE_REALM_LEVEL
  }

  /**
   * Gate dành cho đột phá đại cảnh giới sau Trúc Cơ. Nội dung hiện kết thúc
   * tại Trúc Cơ tầng 18 nên gate đóng hoàn toàn; chỉ mở lại cùng một content
   * pass thiết kế Kim Đan và các requirement/Tribulation tương ứng.
   */
  canTriggerRealmBreakthrough(player: PlayerData): boolean {
    // PRODUCT SCOPE: game hiện chỉ thiết kế tới Trúc Cơ tầng 18. Hàm tổng
    // quát này là phần mở rộng chưa hoàn thiện; không được mở đường sang các
    // realm placeholder (Kim Đan+) trước khi có thiết kế progression tương ứng.
    // Trúc Cơ tầng 18 là điểm cuối nội dung hiện tại. Giữ tham số để API/UI
    // ổn định nhưng không cho mở Tribulation sang các realm placeholder.
    void player

    return false
  }

  /**
   * "Con đường bình thường" của Đột Phá tổng quát (2026-08-16, xem
   * core/breakthrough/BreakthroughRequirement.ts) — Đột Phá Lệnh luyện
   * trực tiếp bằng Linh Thạch, KHÔNG qua Recipe (RecipeResultType
   * không hỗ trợ material làm kết quả): check đủ Linh Thạch rồi trừ và
   * cấp thẳng material. Phân Giải equipment là luồng huỷ item riêng.
   * Plan Workstream F: Linh Thạch là MATERIAL — check/trừ qua
   * MaterialBag, `spiritStoneCost` chỉ còn là authoring sugar được
   * normalize ngay tại boundary này.
   */
  canCraftBreakthroughToken(targetRealmId: string, player: PlayerData): boolean {
    const requirement = BREAKTHROUGH_REQUIREMENTS[targetRealmId]
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(targetRealmId))

    return (
      requirement !== undefined &&
      this.materialRegistry.has(requirement.materialId) &&
      this.materialBag.getAmount(spiritStoneId) >= requirement.spiritStoneCost
    )
  }

  craftBreakthroughToken(targetRealmId: string, player: PlayerData): boolean {
    if (!this.canCraftBreakthroughToken(targetRealmId, player)) {
      return false
    }

    const requirement = BREAKTHROUGH_REQUIREMENTS[targetRealmId]!
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(targetRealmId))

    if (!this.materialBag.remove(spiritStoneId, requirement.spiritStoneCost)) {
      return false
    }

    const overflow = this.materialBag.add(this.materialRegistry.get(requirement.materialId), 1)

    if (overflow > 0) {
      // All-or-nothing: token tràn stack thì hoàn Linh Thạch để không mất
      // trắng (Linh Thạch cap MAX_SAFE_INTEGER nên hoàn lại luôn vừa chỗ).
      this.materialBag.add(this.materialRegistry.get(spiritStoneId), requirement.spiritStoneCost)

      return false
    }

    this.notifyQuestMaterialGained(requirement.materialId, 1)

    return true
  }

  /**
   * Quy đổi Linh Thạch LÊN phẩm kế tiếp (review 2026-08-28,
   * economy-ecosystem-plan T2): 100 Hạ → 1 Trung, 100 Trung → 1 Thượng.
   * CHỈ có chiều lên — không có quy đổi ngược (giữ sink). Giao dịch
   * atomic: check đủ → trừ → cộng; trừ thất bại thì không cộng.
   */
  convertSpiritStonesUp(
    fromMaterialId: string,
    times = 1,
  ): { ok: boolean; reason?: string; gained?: number } {
    const targetId = getNextSpiritStoneMaterialId(fromMaterialId)

    if (!targetId) {
      return { ok: false, reason: 'no_higher_tier' }
    }

    if (!Number.isInteger(times) || times <= 0) {
      return { ok: false, reason: 'invalid_amount' }
    }

    if (!this.materialRegistry.has(fromMaterialId) || !this.materialRegistry.has(targetId)) {
      return { ok: false, reason: 'unknown_material' }
    }

    const cost = SPIRIT_STONE_CONVERSION_RATIO * times

    if (!this.materialBag.remove(fromMaterialId, cost)) {
      return { ok: false, reason: 'insufficient' }
    }

    const overflow = this.materialBag.add(this.materialRegistry.get(targetId), times)

    if (overflow > 0) {
      // Trần stack Linh Thạch là MAX_SAFE_INTEGER nên thực tế không xảy
      // ra; nếu xảy ra thì hoàn lại phẩm thấp để không mất trắng.
      this.materialBag.add(
        this.materialRegistry.get(fromMaterialId),
        overflow * SPIRIT_STONE_CONVERSION_RATIO,
      )

      return { ok: false, reason: 'bag_full' }
    }

    this.notifyQuestMaterialGained(targetId, times)

    return { ok: true, gained: times }
  }

  /**
   * Quy đổi cảnh giới Linh Mộc/Linh Khoáng LÊN bậc kế (2026-08-28): gộp
   * 10 bậc thấp → 1 bậc cao theo thang Phàm Nhân → Luyện Khí → Trúc Cơ.
   * Gỗ `<realm>_wood` → `<nextRealm>_wood`; quáng giữ PHẨM khi lên cảnh
   * giới `<realm>_ore_<quality>` → `<nextRealm>_ore_<quality>`. CHỈ có
   * chiều lên (giữ sink). Giao dịch atomic: check đủ → trừ → cộng; trừ
   * thất bại thì không cộng.
   */
  convertMaterialTier(
    fromMaterialId: string,
    times = 1,
  ): { ok: boolean; reason?: string; gained?: number } {
    const targetId = getNextTierMaterialId(fromMaterialId)

    if (!targetId) {
      return { ok: false, reason: 'no_higher_tier' }
    }

    if (!Number.isInteger(times) || times <= 0) {
      return { ok: false, reason: 'invalid_amount' }
    }

    if (!this.materialRegistry.has(fromMaterialId) || !this.materialRegistry.has(targetId)) {
      return { ok: false, reason: 'unknown_material' }
    }

    const cost = MATERIAL_TIER_CONVERSION_RATIO * times

    if (!this.materialBag.remove(fromMaterialId, cost)) {
      return { ok: false, reason: 'insufficient' }
    }

    const overflow = this.materialBag.add(this.materialRegistry.get(targetId), times)

    if (overflow > 0) {
      this.materialBag.add(
        this.materialRegistry.get(fromMaterialId),
        overflow * MATERIAL_TIER_CONVERSION_RATIO,
      )

      return { ok: false, reason: 'bag_full' }
    }

    this.notifyQuestMaterialGained(targetId, times)

    return { ok: true, gained: times }
  }

  // =========================
  // EQUIPMENT
  // =========================

  /**
   * W5 (2026-08-27) — level Khí Đường giảm chi phí Cường Hóa/Tẩy Luyện/
   * Tinh Luyện. Đồng bộ discount vào EquipmentSystem trước mỗi query/spend.
   */
  private syncEquipmentCostDiscount() {
    const instance = this.buildingManager.getByBuildingId('equipment_hall')

    if (!instance) {
      this.equipmentSystem.setCostDiscountPercent(0)
      return
    }

    const template = this.buildingRegistry.get('equipment_hall')

    this.equipmentSystem.setCostDiscountPercent(
      this.buildingSystem.getCraftModifiers(instance, template).equipmentCostDiscountPercent / 100,
    )
  }

  obtainEquipment(equipmentId: string, player: PlayerData): EquipmentInstance | null {
    if (!this.equipmentRegistry.has(equipmentId)) {
      return null
    }

    const template = this.equipmentRegistry.get(equipmentId)
    const instance = this.equipmentSystem.createInstance(template, player, this.affixRegistry)

    this.equipmentBag.add(instance)

    return instance
  }

  equipItem(instanceId: string, player: PlayerData): boolean {
    return this.equipmentSystem.equip(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.equipmentSlotManager,
      player,
      this.affixRegistry,
    )
  }

  unequipItem(instanceId: string): boolean {
    return this.equipmentSystem.unequip(instanceId, this.equipmentBag)
  }

  /** Cường Hóa gắn SLOT — slot trống vẫn nâng được (slot-level rework). */
  enhanceSlot(slot: EquipmentSlot, player: PlayerData): { ok: boolean; reason?: string } {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.enhance(
      slot,

      player.realmId,

      this.equipmentBag,

      this.equipmentRegistry,

      this.materialBag,

      this.equipmentSlotManager,

      this.affixRegistry,
    )
  }

  getEnhanceCost(slot: EquipmentSlot, realmId: string) {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.getEnhanceCost(
      slot,

      realmId,

      this.equipmentBag,

      this.equipmentRegistry,

      this.equipmentSlotManager,
    )
  }

  getEnhanceSpiritStoneCost(slot: EquipmentSlot, realmId: string): number {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.getEnhanceSpiritStoneCost(
      slot,

      realmId,

      this.equipmentBag,

      this.equipmentRegistry,

      this.equipmentSlotManager,
    )
  }

  getSlotMaxEnhanceLevel(slot: EquipmentSlot, realmId: string): number {
    const equipped = this.equipmentBag.getEquippedInSlot(slot)

    const template = equipped ? this.getEquipmentTemplate(equipped.itemId) : undefined

    return this.equipmentSystem.getMaxEnhanceLevel(template)
  }

  /** Template tra an toàn — registry.get() ném lỗi với id lạ, UI cần undefined. */
  getEquipmentTemplate(itemId: string): Equipment | undefined {
    try {
      return this.equipmentRegistry.get(itemId)
    } catch {
      return undefined
    }
  }

  /** Điểm Rèn per-item hiện tại của 1 instance (= forgePoints, "Tình trạng rèn x/y"). */
  itemRefinementPoints(instance: EquipmentInstance): number {
    return this.equipmentSystem.itemRefinementPoints(instance)
  }

  /**
   * TẦY LUYỆN (plan §7.3) — reroll identity substat bằng Quáng cùng
   * cảnh giới + Điểm Rèn + Linh Thạch. Trả về reason lỗi cho UI.
   */
  washItem(
    instanceId: string,
    oreMaterialId: string,
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    void player

    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.washAffixes(
      instanceId,
      oreMaterialId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  /**
   * TINH LUYỆN (plan §7.4) — reroll giá trị substat ±20%, khóa dòng
   * tùy chọn (cost hệ số N+L). Trả về reason lỗi cho UI.
   */
  refineItem(
    instanceId: string,
    lockedIndices: readonly number[],
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    void player

    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.refineAffixValues(
      instanceId,
      lockedIndices,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  /** W5 — cost Tẩy Luyện sau discount Khí Đường cho UI. realmId của trang
   * bị quyết định PHẨM Linh Thạch tiêu (T2). */
  getWashCost(realmId?: string) {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.getWashCost(realmId)
  }

  /** W5 — cost Tinh Luyện sau discount Khí Đường cho UI. realmId của trang
   * bị quyết định PHẨM Linh Thạch tiêu (T2). */
  getRefineCost(lineCount: number, lockedCount: number, realmId?: string) {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.getRefineCost(lineCount, lockedCount, realmId)
  }

  /**
   * HÓA LUYỆN (plan §7.5) — phân giải batch trang bị thành Tinh Hoa,
   * all-or-nothing. Không tiêu hao Điểm Rèn.
   */
  dissolveItems(instanceIds: readonly string[]): {
    ok: boolean
    reason?: string
    rewards?: Array<{ materialId: string; amount: number }>
  } {
    const result = this.equipmentSystem.dissolveInstances(instanceIds, this.equipmentBag)

    if (result.ok && result.rewards) {
      for (const reward of result.rewards) {
        if (this.materialRegistry.has(reward.materialId)) {
          this.materialBag.add(this.materialRegistry.get(reward.materialId), reward.amount)

          this.notifyQuestMaterialGained(reward.materialId, reward.amount)
        }
      }
    }

    return result
  }

  /** Preview Tinh Hoa nhận được khi Hóa Luyện selection hiện tại (§9.2). */
  previewDissolveRewards(
    instanceIds: readonly string[],
  ): Array<{ materialId: string; minAmount: number; maxAmount: number }> {
    const totals = new Map<string, { min: number; max: number }>()

    for (const instanceId of instanceIds) {
      const instance = this.equipmentBag.get(instanceId)

      if (!instance || instance.equipped || instance.locked || instance.favorite) {
        continue
      }

      const essenceId = equipmentEssenceMaterialId(instance.realmId)

      if (!essenceId) {
        continue
      }

      const range = DISSOLVE_ESSENCE_RANGE_BY_QUALITY[instance.rarity]

      if (!range) {
        continue
      }

      const entry = totals.get(essenceId) ?? { min: 0, max: 0 }

      entry.min += range.min

      entry.max += range.max

      totals.set(essenceId, entry)
    }

    return Array.from(totals, ([materialId, value]) => ({
      materialId,

      minAmount: value.min,

      maxAmount: value.max,
    }))
  }

  /**
   * State cường hóa/formation/bonus affix slots của 1 slot cụ thể —
   * dùng cho UI hiện thông tin NGAY CẢ KHI slot đang trống (MASTER
   * SPEC Mục XVI, Phase 9).
   */
  getSlotState(slot: EquipmentSlot): EquipmentSlotState {
    return this.equipmentSlotManager.get(slot)
  }

  getAllSlotStates(): EquipmentSlotState[] {
    return this.equipmentSlotManager.getAll()
  }

  /**
   * Modifier "tĩnh" từ equipment — xem ghi chú trong Player.ts và
   * EquipmentSystem. Chỉ đổi khi equip/unequip/enhance, caller
   * (player store) tự gán lại vào player.modifiers sau mỗi hành
   * động, KHÔNG gọi mỗi tick như getAggregatedModifiers().
   */
  getEquipmentModifiers(): StatModifier[] {
    return this.equipmentSystem.getModifiers()
  }

  // =========================
  // FORMATION
  // =========================

  // Không còn nhận instanceId (MASTER SPEC Mục XVI, Phase 9) — trận

  // =========================
  // RECIPE / CRAFTING (Đan/Phù/Trận — Khí dùng EquipmentSystem, không qua đây)
  // =========================

  // BUILDing spec mục 15-16 — Building crafting-station (Đan Phòng/

  // =========================
  // PILL
  // =========================

  /**
   * Uống pill (2026-08-24, plan §5.2) — ATOMIC consumption: mọi
   * validation + apply thành công rồi mới remove khỏi PillBag. Pill
   * nghề (có realmId): gate ĐÚNG cảnh giới + 4 effect MVP; legacy pill
   * (không realmId) giữ hành vi cũ. `random` inject cho main stat roll.
   */
  usePillDetailed(
    pillId: string,
    target: PillTarget,
    player: PlayerData,
    random: () => number = Math.random,
  ): {
    ok: boolean
    reason?: 'not_found' | 'wrong_realm' | 'all_main_stats_capped' | 'requires_phap_tu' | 'cap'
    mainStat?: MainStatKey
  } {
    if (!this.pillBag.has(pillId, 1)) {
      return { ok: false, reason: 'not_found' }
    }

    const pill = this.pillRegistry.get(pillId)

    // Exact-realm gate cho pill nghề (plan §5.2).
    if (pill.realmId && pill.realmId !== player.realmId) {
      return { ok: false, reason: 'wrong_realm' }
    }

    const isProfessionPill = pill.effects.some(
      (effect) =>
        effect.type === 'random_main_stat' ||
        effect.type === 'regen' ||
        effect.type === 'skill_insight' ||
        (effect.type === 'cultivation' && effect.cultivationPercent !== undefined),
    )

    if (isProfessionPill) {
      const reason = this.pillSystem.canUseProfessionPill(pill, player)

      if (reason !== 'ok') {
        return { ok: false, reason }
      }

      const result = this.pillSystem.useProfessionPill(pill, player, random)

      if (result.timedEffect) {
        this.applyTimedEffect(player, result.timedEffect)
      }

      this.pillBag.remove(pillId, 1)

      return { ok: true, mainStat: result.mainStat }
    }

    // Legacy path — giữ nguyên hành vi cũ (permanent_stat cap + heal/
    // buff/cultivation flat).
    const cap = getCurrentRealm(player.realmId).attributeCap

    if (!this.pillSystem.canUse(pill, player, cap)) {
      return { ok: false, reason: 'cap' }
    }

    const permanentModifiers = this.pillSystem.use(pill, target)

    for (const modifier of permanentModifiers) {
      const existing = player.modifiers.find((candidate) => candidate.id === modifier.id)

      if (existing) {
        existing.flat = (existing.flat ?? 0) + (modifier.flat ?? 0)
      } else {
        player.modifiers.push(modifier)
      }
    }

    this.pillBag.remove(pillId, 1)

    return { ok: true }
  }

  usePill(pillId: string, target: PillTarget, player: PlayerData): boolean {
    return this.usePillDetailed(pillId, target, player).ok
  }

  // =========================
  // TALISMAN
  // =========================

  // =========================
  // EXPLORATION
  // =========================

  // =========================
  // BUILDING
  // =========================

  getBuildingDefinitions(): Building[] {
    return this.buildingRegistry.getAll()
  }

  /** Gate UI xây mới — delegate BuildingSystem.canBuild (§ popover). */
  canBuildBuilding(buildingId: string, player: PlayerData): boolean {
    return this.buildingSystem.canBuild(
      buildingId,
      this.buildingRegistry,
      this.buildingManager,
      player,
      this.materialBag,
    )
  }

  buildBuilding(buildingId: string, player: PlayerData, currentTime = Date.now() / 1000) {
    const instance = this.buildingSystem.build(
      buildingId,
      this.buildingRegistry,
      this.buildingManager,
      player,
      this.materialBag,
      currentTime,
    )

    // Fix (review 2026-08-26) — build thất bại trước đây IM LẶNG (null
    // không ai đọc): giờ push toast lý do cụ thể để người chơi biết phải
    // làm gì tiếp (thiếu nguyên liệu/cảnh giới...).
    if (!instance) {
      const check = this.buildingSystem.canBuildDetailed(
        buildingId,

        this.buildingRegistry,

        this.buildingManager,

        player,

        this.materialBag,
      )

      this.notifications.push({
        kind: 'error',

        message: `Xây ${this.buildingName(buildingId)} thất bại (${check.reason ?? 'unknown'})`,
      })
    } else {
      this.refreshAutoWorkerCapacity(player, instance)
      this.notifications.push({
        kind: 'upgrade',

        message: `Đã xây ${this.buildingName(buildingId)} · Cấp 1`,
      })
    }

    return instance
  }

  /** Tên building hiển thị cho toast — fallback id khi registry thiếu. */
  private buildingName(buildingId: string): string {
    try {
      return this.buildingRegistry.get(buildingId).name
    } catch {
      return buildingId
    }
  }

  /**
   * gathering_outpost cấp autoWorkerCapacity theo level (workersPerLevel
   * trên Building template) — gọi lại sau mọi lần build/upgrade building
   * này để player.autoWorkerCapacity luôn khớp level hiện tại.
   */
  refreshAutoWorkerCapacity(player: PlayerData, instance: BuildingInstance): void {
    if (instance.buildingId !== 'gathering_outpost') {
      return
    }

    const workersPerLevel = this.buildingRegistry.get(instance.buildingId).workersPerLevel ?? 0
    player.autoWorkerCapacity = instance.level * workersPerLevel
  }

  upgradeBuilding(instanceId: string): boolean {
    const upgraded = this.buildingSystem.upgrade(
      instanceId,
      this.buildingRegistry,
      this.buildingManager,
      this.materialBag,
      this.activePlayer?.realmId,
    )
    const instance = this.buildingManager.get(instanceId)
    if (upgraded && instance && this.activePlayer) {
      this.refreshAutoWorkerCapacity(this.activePlayer, instance)
    }
    return upgraded
  }

  getEnemyTemplate(enemyId: string): Enemy | undefined {
    return this.enemyTemplates.get(enemyId)
  }
  // Linh Tuyền (producesMaterialId) — thu hoạch đổ vào MaterialBag như
  // material bình thường (plan Workstream F); claim() trả amount +
  // materialId, GameManager resolve template và cộng bag.
  collectBuilding(instanceId: string, player: PlayerData, currentTime = Date.now() / 1000): number {
    // Pre-check registry TRƯỚC khi claim reset mốc thời gian (review
    // 2026-08-28): nếu materialId không resolve được mà vẫn claim, sản
    // lượng bị mất trắng (mốc đã reset, bag không được cộng).
    const instance = this.buildingManager.get(instanceId)

    const template = instance ? this.buildingRegistry.get(instance.buildingId) : undefined

    const expectedMaterialId = template
      ? this.buildingSystem.resolveProducesMaterialId(template, player.realmId)
      : undefined

    if (!expectedMaterialId || !this.materialRegistry.has(expectedMaterialId)) {
      return 0
    }

    const claimed = this.buildingSystem.claim(
      instanceId,
      this.buildingRegistry,
      this.buildingManager,
      currentTime,
      player.realmId,
    )

    if (claimed.amount > 0 && claimed.materialId && this.materialRegistry.has(claimed.materialId)) {
      this.materialBag.add(this.materialRegistry.get(claimed.materialId), claimed.amount)

      this.notifyQuestMaterialGained(claimed.materialId, claimed.amount)
    }

    return claimed.amount
  }

  getBuildingStoredAmount(instanceId: string, currentTime = Date.now() / 1000): number {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.buildingSystem.getStoredAmount(
      instance,
      this.buildingRegistry.get(instance.buildingId),
      currentTime,
      this.activePlayer?.realmId,
    )
  }

  getBuildingCapacity(instanceId: string): number {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.buildingSystem.getCapacity(
      instance,
      this.buildingRegistry.get(instance.buildingId),
      this.activePlayer?.realmId,
    )
  }

  getBuildingRatePerMinute(instanceId: string): number {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.buildingSystem.getRatePerMinute(
      instance,
      this.buildingRegistry.get(instance.buildingId),
      this.activePlayer?.realmId,
    )
  }

  // =========================
  // PRODUCTION (2026-08-25 — Lâm/Quáng/Động Thiên, plan §4/§9)
  // =========================

  getProductionViews(nowMs = Date.now()) {
    return this.productionSystem.getSiteDefinitions().map((definition) => {
      const view = this.productionSystem.getSiteView(definition.siteId, nowMs)!

      return {
        definition,

        state: view.state,

        speedMultiplier: view.speedMultiplier,

        nextSpeedMultiplier: view.nextSpeedMultiplier,

        cycleRemainingMs: view.cycleRemainingMs,

        cycleTotalMs: view.cycleTotalMs,
      }
    })
  }

  /** Bắt đầu cycle tại cảnh giới HIỆN TẠI của player (snapshot §4.1). */
  startProductionCycle(siteId: string, player: PlayerData): boolean {
    return this.productionSystem.startCycle(siteId, player.realmId, Date.now())
  }

  setProductionAutoRestart(siteId: string, enabled: boolean): boolean {
    return this.productionSystem.setAutoRestart(siteId, enabled)
  }

  /** Nâng level nguồn — cost Gỗ + Linh Thạch (sink chính của Lâm, §5.2). */
  upgradeProductionSite(siteId: string, player: PlayerData): boolean {
    // Plan Workstream F — Linh Thạch check/trừ trực tiếp trên MaterialBag.
    return this.productionSystem.upgradeSite(siteId, this.materialBag, getRealmTier(player.realmId))
  }

  getProductionUpgradeCost(siteId: string) {
    return this.productionSystem.getSiteDefinition(siteId)?.upgradeCosts
  }

  // =========================
  // ALCHEMY (Đan Phòng — plan §8)
  // =========================

  getAlchemyRecipes(): AlchemyRecipe[] {
    return Array.from(this.alchemyRecipesById.values())
  }

  getAlchemyRecipe(recipeId: string): AlchemyRecipe | undefined {
    return this.alchemyRecipesById.get(recipeId)
  }

  /** Level Đan Phòng (pill_room) hiện hành — chưa xây = 0. */
  getAlchemyRoomLevel(): number {
    return this.buildingManager.getByBuildingId('pill_room')?.level ?? 0
  }

  getAlchemyJobs(): ActiveAlchemyJob[] {
    return this.alchemySystem.getJobs()
  }

  /**
   * Bắt đầu luyện đan — reserve nguyên liệu ATOMIC (§8.2); slot job theo
   * concurrent_job_slots effect của pill_room (mặc định 1).
   */
  startAlchemyJob(
    recipeId: string,
    herbMaterialId: string,
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    const recipe = this.alchemyRecipesById.get(recipeId)

    if (!recipe) {
      return { ok: false, reason: 'not_found' }
    }

    const instance = this.buildingManager.getByBuildingId('pill_room')

    if (!instance) {
      return { ok: false, reason: 'room_not_built' }
    }

    const template = this.buildingRegistry.get('pill_room')
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(recipe.realmId))

    const maxSlots = this.buildingSystem.getCraftModifiers(instance, template).concurrentJobSlots

    const started = this.alchemySystem.startJob(
      recipe,

      herbMaterialId,

      this.materialBag,

      this.materialRegistry,

      this.materialBag.getAmount(spiritStoneId),

      instance.level,

      Date.now(),

      maxSlots,
    )

    // Bugfix (review 2026-08-26) — Linh Thạch được CHECK ở startJob
    // nhưng chưa từng được TRỪ: luyện đan miễn phí. Trừ sau khi reserve
    // nguyên liệu thành công (all-or-nothing như mọi sink khác).
    // Plan Workstream F — trừ trên MaterialBag.
    if (started.ok && recipe.spiritStoneCost > 0) {
      this.materialBag.remove(spiritStoneId, recipe.spiritStoneCost)
    }

    return started
  }

  cancelAlchemyJob(jobId: string): boolean {
    return this.alchemySystem.cancelJob(jobId)
  }

  /** Preview tổng tỷ lệ thành + guaranteed + chance viên cộng thêm (§9.3). */
  previewAlchemyOutcome(
    recipeId: string,
    herbMaterialId: string,
    roomLevel = Math.max(1, this.getAlchemyRoomLevel()),
  ): {
    totalPercent: number

    guaranteedPills: number

    extraPillChance: number

    durationSeconds: number
  } | null {
    const recipe = this.alchemyRecipesById.get(recipeId)

    const variant = recipe?.herbVariants.find(
      (candidate) => candidate.materialId === herbMaterialId,
    )

    if (!recipe || !variant) {
      return null
    }

    const totalPercent = Math.min(
      (HERB_AGE_BASE_SUCCESS_PERCENT[variant.age] ?? 0) + alchemyRoomSuccessBonus(roomLevel),
      300,
    )

    return {
      totalPercent,

      guaranteedPills: Math.floor(totalPercent / 100),

      extraPillChance: totalPercent % 100,

      durationSeconds: alchemySecondsFor(recipe, roomLevel),
    }
  }

  // =========================
  // BATTLE
  // =========================

  spawnEnemy(template: Enemy): Enemy {
    return this.enemySystem.spawn(template)
  }

  startBattle(player: CombatEntity, enemy: Enemy) {
    const enemyEntity = enemyToCombatEntity(this.enemySystem.spawn(enemy))

    // Spawn placement (plan §5.1) — row/column do resolver roll trong
    // queueEnemySpawn (Boss luôn row 4); không còn gán lane ngoài.

    // Reset mặc định — startBattleWithPlayer() sẽ set lại session
    // (receiver/player) thật ngay sau lệnh gọi này. Battle bắt đầu qua
    // startBattle() trực tiếp (không phải PlayerData) thì không có ai
    // nhận thưởng hay đồ rơi (equipment cần player để roll chỉ số chính).
    // Stack passive (vd Linh Khí Cảm Ứng +công kích/đòn trúng) là
    // buff TRONG TRẬN — reset về 0 mỗi khi 1 trận mới bắt đầu, kể cả
    // khi Auto tự nối trận ngay lập tức (theo yêu cầu, khác thiết kế
    // permanent progression ban đầu).
    this.battleLoot.beginBattle()
    this.passiveSystem.resetStacks()

    // Bất Tử Thể — reset mặc định về KHÔNG bảo vệ; startBattleWithPlayer()
    // sẽ set lại session thật ngay sau (cùng pattern battleLoot.setSession()).
    // Trận startBattle() trực tiếp (không PlayerData) thì không có thiên phú.
    this.combatSystem.setSurviveLethalSession(null)

    this.battleSystem.start(player, enemyEntity)
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
    // DESIGN: mọi chỉ số combat, gồm skill runtime stats, được snapshot lúc
    // bắt đầu trận. Mua node/đổi trang bị/loadout giữa trận chỉ có hiệu lực từ
    // trận kế tiếp; không đụng tới CombatEntity đang chiến đấu.
    //
    // Runtime authority (2026-08-24, plan §5.4): `playerStats` là snapshot
    // TĨNH (getAggregatedModifiers chỉ trả static — runtime không nằm ở
    // đó); timed effect + socket modifier chảy vào combat qua provider
    // MỖI TICK (updateStatsFromModifiers) → effect hết hạn giữa trận tự
    // trở về baseline, không double-apply, không đóng băng trong baseStats.
    const skillLevels = Object.fromEntries(
      this.skillManager.getAll().map((skill) => [skill.id, skill.level]),
    )
    const playerEntity = playerToCombatEntity(
      player,
      playerStats,
      this.getSkillRuntimeStats(player),
      skillLevels,
    )

    this.startBattle(playerEntity, enemy)

    this.battleLoot.setSession(this.buildPlayerRewardReceiver(player), player)

    // Bất Tử Thể (talent-direction-choice-plan §6) — reset lượt sống sót
    // theo thiên phú của player mỗi trận MỚI rồi gắn session cho
    // combatSystem.killIfDead(). playerEntity.id là 'player' (xem
    // playerToCombatEntity()).
    this.surviveLethalGuard.beginBattle(player.selectedTalentIds)
    this.combatSystem.setSurviveLethalSession({
      playerEntityId: playerEntity.id,
      guard: this.surviveLethalGuard,
    })

    // Bản Mệnh Pháp Bảo — snapshot level/grade/path/equippedElements
    // NGAY lúc trận bắt đầu (doc §11); undefined nếu player không có
    // artifact (Kiếm Tu/chưa Trúc Cơ) — updateArtifactActivation() tự
    // no-op trong trường hợp đó.
    this.battleSystem.setArtifactRuntime(
      player.artifact
        ? createArtifactRuntime(
            player.artifact,
            filterNguHanhElements(player.equippedElements),
            playerEntity.currentWard,
          )
        : undefined,
    )
  }

  getBattle(): Battle | null {
    return this.battleSystem.getBattle()
  }

  /**
   * RewardReceiver dùng chung cho mọi nơi cấp Reward trực tiếp cho
   * player (battle victory, claim quest...) — insight đổ vào tâm pháp
   * đang trang bị, Linh Thạch đổ vào MaterialBag (Plan Workstream F).
   */
  private buildPlayerRewardReceiver(player: PlayerData): RewardReceiver {
    return createPlayerRewardReceiver(
      player,
      (amount) => this.gainEquippedTechniqueInsight(amount),
      (amount) => {
        // Cấp ĐÚNG phẩm Linh Thạch theo cảnh giới hiện tại (khớp phẩm mà
        // chi phí Đột Phá/Cường Hóa/nâng cấp công trình đòi hỏi ở cảnh
        // giới đó) — không cấp cứng Hạ Phẩm khiến người chơi cảnh giới
        // cao kẹt lại vì có Linh Thạch nhưng sai phẩm.
        const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

        if (amount > 0 && this.materialRegistry.has(spiritStoneId)) {
          this.materialBag.add(this.materialRegistry.get(spiritStoneId), amount)

          this.notifyQuestMaterialGained(spiritStoneId, amount)
        }
      },
    )
  }

  // =========================
  // QUEST (Nhiệm Vụ)
  // =========================

  /**
   * Collect-quest hook (review 2026-08-28 bug #3) — gọi MỖI KHI material
   * vào túi người chơi để tăng progress collect-quest đang active. KHÔNG
   * gọi khi restore từ save (double-count). BattleLootSystem tự gọi trực
   * tiếp (có deps quest); các đường cộng material còn lại của GameManager
   * (production settle, claim toà nhà, Hóa Luyện, Linh Thạch reward...)
   * đi qua helper này.
   */
  private notifyQuestMaterialGained(materialId: string, amount: number): void {
    this.questSystem.onMaterialCollected(this.questRegistry, this.questManager, materialId, amount)
  }

  getActiveQuests(): { quest: Quest; progress: QuestProgress }[] {
    if (!this.activePlayer) {
      return []
    }

    return this.questSystem.getActiveQuests(
      this.questRegistry,
      this.questManager,
      this.activePlayer,
    )
  }

  canClaimQuest(questId: string): boolean {
    return this.questSystem.canClaim(
      this.questRegistry,
      this.questManager,
      {
        materialRegistry: this.materialRegistry,
        materialBag: this.materialBag,
        pillRegistry: this.pillRegistry,
        pillBag: this.pillBag,
      },
      questId,
    )
  }

  claimQuest(questId: string): boolean {
    if (!this.activePlayer) {
      return false
    }

    const receiver = this.buildPlayerRewardReceiver(this.activePlayer)

    const claimed = this.questSystem.claim(
      this.questRegistry,
      this.questManager,
      this.rewardSystem,
      receiver,
      {
        materialRegistry: this.materialRegistry,
        materialBag: this.materialBag,
        pillRegistry: this.pillRegistry,
        pillBag: this.pillBag,
      },
      questId,
    )

    if (claimed) {
      const quest = this.questRegistry.get(questId)
      this.notifications.push({ kind: 'loot', message: `Hoàn thành: ${quest.name}` })
    }

    return claimed
  }

  gainEquippedTechniqueInsight(amount: number): number {
    const technique = this.techniqueManager.getEquipped()

    if (!technique || amount <= 0) {
      return 0
    }

    const before = technique.insight ?? 0
    const cap = getTechniqueInsightTotalRequired(technique)
    technique.insight = Math.min(cap, before + amount)

    return technique.insight - before
  }

  /**
   * Độ Kiếp (mục 11 spec `breakthrough`) — khởi trận đấu với quái Kiếp,
   * bỏ qua Stage hoàn toàn (giống startBattle() nhận Enemy bất kỳ).
   * Enemy Kiếp phải đã được đăng ký qua registerEnemyTemplates().
   *
   * Đột Phá tổng quát (2026-08-16) — `foundationType` CHỈ truyền khi
   * targetRealmId === 'foundation_establishment' (tra TRIBULATION_ENEMY_ID_BY_FOUNDATION,
   * hệ Căn Cơ 4-tier cũ, không đổi); mọi targetRealmId khác tra
   * TRIBULATION_ENEMY_ID_BY_REALM (1 quái Kiếp/cảnh giới, không tier).
   */
  /**
   * Độ Kiếp (mục 11 spec `breakthrough`) — delegate xuống
   * TribulationSystem (runtime trận Kiếp). Session loot được khởi tạo
   * RIÊNG qua BattleLootSystem.beginTribulation(): reset receiver +
   * reward summary của trận Stage trước (P2 fix 2026-08-24) rồi gắn
   * player của phiên Độ Kiếp.
   */
  startTribulation(
    player: PlayerData,
    playerStats: Stats,
    targetRealmId: string,
    foundationType?: FoundationType,
  ): boolean {
    const started = this.tribulation.start(player, playerStats, targetRealmId, foundationType)

    if (started) {
      this.battleLoot.beginTribulation(player)

      // Bất Tử Thể KHÔNG kích hoạt trong trận Độ Kiếp (plan §6 — giữ Độ
      // Kiếp là nghi lễ thật). Trận Kiếp KHÔNG đi qua startBattle() nên
      // phải tự xoá session ở đây, tránh lượt sống sót tồn dư từ trận
      // Stage trước chảy vào.
      this.surviveLethalGuard.beginTribulation()
      this.combatSystem.setSurviveLethalSession(null)
    }

    return started
  }

  getTribulationCooldownSeconds(now = Date.now()): number {
    return this.tribulation.getCooldownSeconds(now)
  }

  getActiveTribulation(): ActiveTribulation | null {
    return this.tribulation.getActive()
  }

  clearActiveTribulation() {
    this.tribulation.clear()
  }

  /**
   * Áp 1 buff/debuff PERSISTENT (ngoài trận) lên player — dùng cho
   * Kiếp Thương khi thất bại Độ Kiếp (mục 13 spec `breakthrough`).
   * Cùng buffSystem/buffManager nuôi getAggregatedModifiers() mỗi
   * tick (xem PillSystem's effect 'buff' — cùng cơ chế).
   */
  applyPersistentBuff(buff: Buff) {
    this.buffSystem.apply(buff)
  }

  giveReward(receiver: RewardReceiver, reward: Reward) {
    this.rewardSystem.give(receiver, reward)
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
    const battle = this.battleSystem.getBattle()

    if (!battle || (battle.state !== 'countdown' && battle.state !== 'fighting')) {
      return false
    }

    battle.state = 'defeat'
    this.stageWaves.stopRepeat()

    this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })

    return true
  }

  // =========================
  // STAGE (wave spawn)
  // =========================
  // Vòng đời wave (spawn nhịp, victory, auto-repeat, boss summon) nằm ở
  // StageWaveSystem — các method dưới đây là delegate giữ public API.

  startStage(
    player: PlayerData,
    playerStats: Stats,
    stage: Stage,
    repeatContinuously = false,
  ): boolean {
    return this.stageWaves.start(player, playerStats, stage, repeatContinuously)
  }

  getStageProgress(): { spawned: number; total: number; alive: number } | null {
    return this.stageWaves.getProgress()
  }

  // =========================
  // SAVE / LOAD
  // =========================

  /**
   * Nạp lại toàn bộ state đã lưu vào các Manager tương ứng. PHẢI
   * gọi sau khi registerMaterials/registerEquipment/registerPills/
   * registerTalismans/registerSkillTemplates/registerTechniqueTemplates
   * đã chạy — materials/pills/talismans resolve theo id qua registry,
   * cần registry đã có data trước.
   *
   * Trả về modifier equipment mới nhất để caller đồng bộ vào
   * player.modifiers (equipmentSystem.getModifiers() không tự biết
   * gọi player.setEquipmentModifiers()).
   */
  restoreFromSave(save: GameSave): StatModifier[] {
    for (const technique of save.techniques) {
      if (!this.techniqueManager.has(technique.id)) {
        this.techniqueManager.add(technique)
      }
    }

    for (const skill of save.skills) {
      if (this.skillManager.has(skill.id)) {
        continue
      }

      // Execution policy rework + development-build no-migration (2026-
      // 08-26): save của nhân vật CŨ lưu skill object nguyên trạng trước
      // khi có field `execution` bắt buộc — scheduler thống nhất BỎ QUA
      // mọi active thiếu execution ("không cast gì" dù tele/di chuyển
      // vẫn chạy). Đối chiếu template đã đăng ký để hồi phục AUTHORED
      // combat data (execution/targeting/AOE/VFX preset), giữ NGUYÊN
      // progression state của instance (level/equipped/slot/cooldown/
      // specialization). Template thiếu thì giữ nguyên object save.
      const template = this.skillTemplates.get(skill.id)

      if (!skill.execution && template?.execution) {
        skill.execution = structuredClone(template.execution)
      }

      if (!skill.targeting && template?.targeting) {
        skill.targeting = structuredClone(template.targeting)
      }

      this.skillManager.add(skill)
    }

    for (const entry of save.materials) {
      if (this.materialRegistry.has(entry.materialId)) {
        this.materialBag.add(this.materialRegistry.get(entry.materialId), entry.amount)
      }
    }

    for (const entry of save.pills) {
      if (this.pillRegistry.has(entry.pillId)) {
        this.pillBag.add(this.pillRegistry.get(entry.pillId), entry.amount)
      }
    }

    // Phù/Trận legacy (plan §10.1): save đã qua migration v44 có mảng
    // rỗng — bỏ qua hoàn toàn, không còn bag để nạp.

    for (const instance of save.equipment) {
      // Item template cũ đã bị xoá theo equipment rework; bỏ hẳn instance
      // mồ côi thay vì để restoreModifiers truy cập registry và crash.
      if (this.equipmentRegistry.has(instance.itemId)) {
        this.equipmentBag.add(instance)
      }
    }

    // MASTER SPEC Mục XVI (Phase 9) — slot state (enhance) PHẢI nạp
    // trước refreshModifiers() bên dưới.
    this.equipmentSlotManager.restore(save.equipmentSlots)

    // ModifierSystem nội bộ của equipmentSystem không tự phục hồi
    // theo EquipmentBag vừa nạp — phải build lại thủ công.
    this.equipmentSystem.refreshModifiers(
      this.equipmentBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )

    this.buildingManager.restore(save.buildings)

    this.questManager.restore(
      save.quests ?? { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    )

    // Production (plan §4.3) — restore state + offline settle tuần tự
    // trong cap; MỖI auto-cycle một seed/roll riêng.
    this.productionSystem.restoreStates((save.productionSites ?? []) as ProductionSiteState[])

    for (const definition of this.productionSystem.getSiteDefinitions()) {
      this.productionSystem.ensureSiteState(definition.siteId)
    }

    if (this.activePlayer) {
      const elapsedOfflineSeconds = Math.max(
        0,
        (Date.now() - (save.player.lastSavedAt ?? Date.now())) / 1000,
      )

      if (elapsedOfflineSeconds > 60) {
        // T3 (economy-ecosystem-plan) — worker chạy offline như slot tay
        // trong cap: truyền capacity + mốc bắt đầu vắng mặt để settle
        // đúng cửa sổ.
        this.productionSystem.settleOffline(
          this.materialBag,
          this.materialRegistry,
          this.activePlayer.realmId,
          Date.now(),
          {
            workerCapacity: this.activePlayer.autoWorkerCapacity ?? 0,
            offlineSinceMs: save.player.lastSavedAt ?? Date.now(),
          },
        )
      }
    }

    // Đan Phòng offline settle (§8.2).
    this.alchemySystem.restoreJobs((save.alchemyJobs ?? []) as ActiveAlchemyJob[])

    this.alchemySystem.settleOffline(
      this.pillBag,
      (pillId) => (this.pillRegistry.has(pillId) ? this.pillRegistry.get(pillId) : undefined),
      Date.now(),
      getAlchemySuccessBonusPercentPoints(this.activePlayer?.selectedTalentIds ?? []),
    )

    return this.equipmentSystem.getModifiers()
  }

  // =========================
  // TICK
  // =========================

  /**
   * Gọi mỗi tick từ game loop (App.vue) với deltaSeconds đo được
   * từ GameClock. GameManager chỉ forward xuống các system có
   * trạng thái phụ thuộc thời gian — không tự tính thời gian.
   */
  update(deltaSeconds: number) {
    if (deltaSeconds <= 0) {
      return
    }

    // Timed effect theo thời gian thực — tick expiry ở MỌI update (cả
    // khi pause battle) vì deadline là Date.now() tuyệt đối, không dùng
    // game delta kéo dài buff (plan §5.4). Player reference do App.vue
    // đăng ký qua setActivePlayer() sau boot/load.
    if (this.activePlayer) {
      this.tickTimedEffects(this.activePlayer)

      // Quest daily reset (Quest System plan) — wall-clock day-bucket,
      // check mỗi tick nên vẫn reset kể cả khi panel Nhiệm Vụ đang đóng.
      if (
        this.questSystem.checkAndResetDaily(
          this.questRegistry,
          this.questManager,
          this.activePlayer,
        )
      ) {
        this.notifications.push({ kind: 'craft', message: 'Nhiệm vụ hàng ngày đã làm mới' })
      }

      // Production settle (plan §4.3) — delivery thẳng Bag khi cycle
      // hoàn thành; notification ghi rõ vật liệu + số lượng (§9.1).
      this.productionSystem.tick(
        Date.now(),
        this.materialBag,
        this.materialRegistry,
        this.activePlayer.realmId,
      )

      this.productionSystem.tickWorkers(
        Date.now(),
        this.materialBag,
        this.materialRegistry,
        this.activePlayer.realmId,
        this.activePlayer.autoWorkerCapacity ?? 0,
      )

      for (const event of this.productionSystem.drainSettlementEvents()) {
        const material = this.materialRegistry.has(event.materialId)
          ? this.materialRegistry.get(event.materialId)
          : undefined

        // Collect-quest hook (review 2026-08-28) — production settle là
        // nguồn material chính của collect-quest. Chỉ tính lượng thật sự
        // vào túi (trừ overflow).
        this.notifyQuestMaterialGained(event.materialId, event.amount - (event.overflow ?? 0))

        this.notifications.push({
          kind: 'loot',
          message: `${material?.name ?? event.materialId} ×${event.amount}`,
        })
      }

      // Đan Phòng settle (§8.3). Thiên phú Đan Duyên cộng điểm % thành
      // đan (plan §6) — đọc từ activePlayer mỗi tick, đổi talent là có hiệu lực.
      this.alchemySystem.tick(
        Date.now(),
        this.pillBag,
        (pillId) => (this.pillRegistry.has(pillId) ? this.pillRegistry.get(pillId) : undefined),
        Math.random,
        getAlchemySuccessBonusPercentPoints(this.activePlayer.selectedTalentIds),
      )

      for (const event of this.alchemySystem.drainSettlementEvents()) {
        const pill = this.pillRegistry.has(event.pillId)
          ? this.pillRegistry.get(event.pillId)
          : undefined

        this.notifications.push({
          kind: 'craft',
          message: event.success
            ? `${pill?.name ?? event.pillId} ×${event.pills}`
            : `Luyện ${pill?.name ?? event.pillId} thất bại`,
        })
      }
    }

    this.buffSystem.update(deltaSeconds)

    // cooldownReduction đọc từ battle.player.stats (CombatEntity) đang
    // sống trong trận nếu có — ngoài combat (menu/màn hình cảnh giới)
    // không có battle nào thì mặc định 0, khớp hành vi cũ.
    const activeBattle = this.battleSystem.getBattle()

    this.skillSystem.update(deltaSeconds, activeBattle?.player.stats.cooldownReduction ?? 0)

    this.passiveSystem.tick(deltaSeconds)

    this.updateBattleFixedStep(deltaSeconds)
  }

  /**
   * Chia deltaSeconds thành các bước cố định BATTLE_FIXED_STEP_SECONDS
   * cho nhánh phụ thuộc timer-đếm-ngược-rồi-reset (đòn đánh, spawn
   * quái, phần thưởng) — xem ghi chú ở BATTLE_FIXED_STEP_SECONDS phía
   * trên. Giới hạn ở BATTLE_MAX_CATCHUP_SECONDS để không lặp hàng ngàn
   * bước khi deltaSeconds bất thường lớn.
   *
   * updateTribulation()/updateTribulationProgress() CHỦ Ý đứng NGOÀI
   * vòng lặp bước nhỏ: updateTribulation() đã tự có vòng lặp catch-up
   * riêng (while nextStrikeInSeconds <= 0) hoạt động đúng với deltaSeconds
   * lớn dạng đóng (không tích luỹ theo bước), gọi 1 lần với deltaSeconds
   * gốc là chính xác. Chia nhỏ nó thành hàng trăm bước 0.1s sẽ CỘNG DỒN
   * sai số dấu phẩy động (0.1 không biểu diễn chẵn nhị phân) vào
   * active.nextStrikeInSeconds, có thể làm lệch 1 lôi kích so với thật.
   */

  private updateBattleFixedStep(deltaSeconds: number) {
    let remaining = Math.min(deltaSeconds, BATTLE_MAX_CATCHUP_SECONDS)

    while (remaining > 0) {
      const step = Math.min(BATTLE_FIXED_STEP_SECONDS, remaining)

      remaining -= step

      this.battleSystem.update(step)
      this.grantBattleRewardIfNeeded()
      this.stageWaves.update(step)
      this.stageWaves.resolveBossSummons()
    }

    // Ngoài vòng fixed-step — TribulationSystem tự có catch-up dạng đóng,
    // chia nhỏ sẽ cộng dồn sai số float (xem class doc bên đó).
    this.tribulation.update(deltaSeconds)
    this.tribulation.updateProgress()
  }

  private grantBattleRewardIfNeeded() {
    const battle = this.battleSystem.getBattle()

    if (battle) {
      this.battleLoot.processDefeatedEnemies(battle)
    }
  }

  /**
   * Vue layer (App.vue's tick()) gọi mỗi tick để rút toast phát sinh
   * TRONG core kể từ lần gọi trước — trả về rồi xoá hàng đợi.
   */
  drainNotifications(): NotificationEvent[] {
    return this.notifications.drain()
  }
}
