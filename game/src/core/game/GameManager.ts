import { EventBus } from '../events/EventBus'

import { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'



import { BattleSystem } from '../battle/BattleSystem'
import type { Battle } from '../battle/Battle'
import { applySpawnLaneRule } from '../battle/BattleLane'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'

import type { FoundationType } from '../breakthrough/FoundationType'

import { investTinhHoa, computeBreakthroughGrade } from '../realm/BodyRefinementSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'

import { BuffManager } from '../buff/BuffManager'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import type { Buff } from '../buff/Buff'

import { AilmentRegistry } from '../ailment/AilmentRegistry'
import type { AilmentTemplate } from '../ailment/AilmentRegistry'

import { NodeRegistry } from '../progression/NodeRegistry'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { purchaseNode as purchaseNodeSystem } from '../progression/NodeSystem'

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
import { TalismanBag } from '../talisman/TalismanBag'
import { TalismanSystem } from '../talisman/TalismanSystem'
import type { Talisman } from '../talisman/Talisman'

import { FormationRegistry } from '../formation/FormationRegistry'
import { FormationBag } from '../formation/FormationBag'
import { FormationSystem } from '../formation/FormationSystem'
import type { Formation } from '../formation/Formation'

import { RecipeRegistry } from '../recipe/RecipeRegistry'
import { CraftingManager, type ActiveCraft } from '../recipe/CraftingManager'
import { CraftingSystem } from '../recipe/CraftingSystem'
import type { Recipe, RecipeResultType } from '../recipe/Recipe'

import { ItemRegistry } from '../item/ItemRegistry'
import type { ItemGrade } from '../item/ItemGrade'

import { ExplorationManager } from '../exploration/ExplorationManager'
import { ExplorationSystem } from '../exploration/ExplorationSystem'
import type { Exploration } from '../exploration/Exploration'
import type { ExplorationMaterialReward } from '../exploration/ExplorationReward'
import type { ExplorationResult } from '../exploration/ExplorationResult'

import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import { GardenSystem } from '../building/GardenSystem'
import type { Building } from '../building/Building'
import type { CraftModifiers } from '../building/BuildingLevelEffect'
import { ProcessingRecipeRegistry } from '../building/ProcessingRecipeRegistry'
import type { ProcessingRecipe } from '../building/ProcessingRecipe'

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

import { CORE_REALM_LEVEL, getCurrentRealm, getRealmIndex, getMaxConcurrentExplorations } from '../realm/realmSystem'
import { BREAKTHROUGH_REQUIREMENTS } from '../breakthrough/BreakthroughRequirement'

import type { GameSave } from '../../services/save/SaveSystem'

import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'

export interface ExplorationDataEntry {
  exploration: Exploration
  rewards: ExplorationMaterialReward[]
}

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
// rồi reset về mốc mới (playerAttackTimer, attackTimer, spawnCountdown) —
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

  readonly actionImpact = new ActionImpactSystem({ eventBus: this.eventBus, rollCritical: (s, t) => this.combatSystem.rollCritical(s, t) })

  readonly buffManager = new BuffManager()
  readonly buffSystem = new BuffSystem(this.buffManager)
  readonly buffRegistry = new BuffRegistry()

  readonly ailmentRegistry = new AilmentRegistry()

  readonly skillManager = new SkillManager()
  readonly skillSystem = new SkillSystem(this.skillManager, (skill, levelsGained) => {
    this.notifications.push({
      kind: 'upgrade',
      message: levelsGained === 1
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
  )

  readonly techniqueManager = new TechniqueManager()
  readonly techniqueSystem = new TechniqueSystem(this.techniqueManager)

  readonly materialRegistry = new MaterialRegistry()
  readonly materialBag = new MaterialBag()

  // Cần materialBag đã có giá trị (trừ nguyên liệu khi bắt đầu
  // craft) — khai báo sau materialBag.
  readonly recipeRegistry = new RecipeRegistry()
  readonly craftingManager = new CraftingManager()
  readonly craftingSystem = new CraftingSystem(this.craftingManager, this.materialBag)

  readonly equipmentRegistry = new EquipmentRegistry()
  readonly equipmentBag = new EquipmentBag()
  readonly equipmentSystem = new EquipmentSystem()

  // Core Loop Foundation checklist (Phase 3, Mục AFFIX) — thay thế
  // hoàn toàn substatPool cũ.
  readonly affixRegistry = new AffixRegistry()

  // MASTER SPEC Mục XVI (Phase 9) — Cường Hóa/Khắc Trận/Yểm Phù sống
  // ở đây (theo SLOT, 6 slot cố định), tách khỏi EquipmentInstance.
  readonly equipmentSlotManager = new EquipmentSlotManager()

  // Cần equipmentBag/equipmentSlotManager đã có giá trị (đọc vũ khí
  // đang equipped + slot state mỗi lần proc) — khai báo sau đó.
  readonly formationRegistry = new FormationRegistry()
  readonly formationBag = new FormationBag()
  readonly formationSystem = new FormationSystem(this.eventBus, this.equipmentBag, this.equipmentSlotManager)

  readonly pillRegistry = new PillRegistry()
  readonly pillBag = new PillBag()
  readonly pillSystem = new PillSystem(this.buffSystem)

  readonly talismanRegistry = new TalismanRegistry()
  readonly talismanBag = new TalismanBag()
  readonly talismanSystem = new TalismanSystem(this.equipmentSystem)

  readonly itemRegistry = new ItemRegistry(
    this.equipmentRegistry,
    this.pillRegistry,
    this.talismanRegistry,
    this.materialRegistry,
  )

  readonly explorationManager = new ExplorationManager()
  readonly explorationSystem = new ExplorationSystem(
    this.explorationManager,
    this.materialBag,
    this.materialRegistry,
  )

  readonly buildingRegistry = new BuildingRegistry()
  readonly buildingManager = new BuildingManager()
  readonly buildingSystem = new BuildingSystem()
  readonly gardenSystem = new GardenSystem()
  readonly processingRecipeRegistry = new ProcessingRecipeRegistry()

  readonly enemyManager = new EnemyManager()
  readonly enemySystem = new EnemySystem(this.enemyManager)

  readonly stageManager = new StageManager()
  readonly stageSystem = new StageSystem()

  readonly rewardSystem = new RewardSystem()

  private explorationData = new Map<string, ExplorationDataEntry>()

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
      launchBattle: (player, playerStats, enemy) => this.startBattleWithPlayer(player, playerStats, enemy),
    })

    this.tribulation = new TribulationSystem({
      eventBus: this.eventBus,
      battleSystem: this.battleSystem,
      combatSystem: this.combatSystem,
      buildPlayerSnapshot: (player, playerStats) => {
        const skillLevels = Object.fromEntries(this.skillManager.getAll().map(skill => [skill.id, skill.level]))

        return playerToCombatEntity(player, playerStats, this.skillSystem.getSkillRuntimeStats(), skillLevels)
      },
    })
  }

  // =========================
  // DATA REGISTRATION
  // =========================
  // Nạp dữ liệu tĩnh (từ /data) vào các Manager. Gọi 1 lần lúc
  // khởi tạo game. Tách riêng khỏi constructor để có thể gọi lại
  // trong test hoặc khi cần nạp thêm data theo DLC/patch sau này.

  registerMaterials(materials: Material[]) {
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

  registerExplorations(entries: ExplorationDataEntry[]) {
    for (const entry of entries) {
      this.explorationData.set(entry.exploration.id, entry)
    }
  }

  registerBuildings(items: Building[]) {
    for (const item of items) {
      if (!this.buildingRegistry.has(item.id)) {
        this.buildingRegistry.register(item)
      }
    }
  }

  registerProcessingRecipes(items: ProcessingRecipe[]) {
    for (const item of items) {
      if (!this.processingRecipeRegistry.has(item.id)) {
        this.processingRecipeRegistry.register(item)
      }
    }
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
    for (const formation of formations) {
      if (!this.formationRegistry.has(formation.id)) {
        this.formationRegistry.register(formation)
      }
    }
  }

  registerTalismans(talismans: Talisman[]) {
    for (const talisman of talismans) {
      if (!this.talismanRegistry.has(talisman.id)) {
        this.talismanRegistry.register(talisman)
      }
    }
  }

  registerRecipes(recipes: Recipe[]) {
    for (const recipe of recipes) {
      if (!this.recipeRegistry.has(recipe.id)) {
        this.recipeRegistry.register(recipe)
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
        playerRealmIndex === requiredRealmIndex
        && stage.requiredRealmLevel !== undefined
        && player.realmLevel < stage.requiredRealmLevel
      ) {
        return false
      }
    }

    const zones = this.zoneRegistry.getAll()
    const zoneIndex = zones.findIndex(candidate => candidate.stageIds.includes(stageId))
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
   * Pháp Tu Redesign (magicpath) — mua 1 ProgressionNode. Gọi
   * `purchaseNode()` thuần (core/progression/NodeSystem.ts) trước —
   * hàm đó tự xử lý MỌI thứ không cần registry (trừ skillInsight, đánh
   * dấu đã mua, statModifiers, unlocksElement). Chỉ còn
   * `unlocksSkillIds` cần learnSkill() (cần skillTemplates, GameManager
   * mới có) — làm NGAY SAU nếu node đó có khai field này. KHÔNG tự
   * equip skill vừa unlock (giữ nguyên tinh thần "học" khác "trang bị"
   * đã có ở mọi nơi khác trong game, xem SkillManager.learn()/equip()).
   */
  purchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.nodeRegistry.has(nodeId)) {
      return false
    }

    const node = this.nodeRegistry.get(nodeId)

    if (!purchaseNodeSystem(player, node)) {
      return false
    }

    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId)
    }

    // Skill rework (2026-08-21) — statModifiers nhắm CombatEntity.stats
    // (chung), skillModifiers nhắm THẲNG field trên Skill instance —
    // cần skillManager (không có ở NodeSystem.ts thuần) nên xử lý ở
    // đây, cùng lý do unlocksSkillIds ở trên.
    for (const { skillId, statModifiers } of node.effect.skillModifiers ?? []) {
      const skill = this.skillManager.get(skillId)

      if (!skill) {
        continue
      }

      for (const modifier of statModifiers) {
        const current = skill[modifier.stat] ?? 0

        if (modifier.flat !== undefined) {
          skill[modifier.stat] = current + modifier.flat
        }

        if (modifier.percent !== undefined) {
          skill[modifier.stat] = current * (1 + modifier.percent)
        }
      }
    }

    return true
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
    if (player.cultivationPath || player.realmId !== 'mortal' || player.realmLevel < CORE_REALM_LEVEL) {
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
      // đánh được trận nào. equipToSlot() tự lo phần "gỡ Trảm" (mutual-
      // exclusion isBasicAttack, xem SkillSystem.ts) — không cần unequip
      // tay như trước. Vì luôn có basic attack ngay sau bước này, gate
      // blockIfNoBasicAttack() ở useBattleActions.ts/useTribulation.ts
      // đã GỠ theo (không còn tình huống "chưa trang bị gì" nữa).
      // Thủy/Mộc/Thổ/Kim KHÔNG tự mua — root node của 4 hành đó tốn 2
      // Skill Point, người chơi tự mua qua Node Tree UI.
      const mortalBasicAttack = this.skillManager.getBasicAttackSkill()
      if (mortalBasicAttack) this.skillSystem.unequip(mortalBasicAttack.id)

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

  // Equip KHÔNG qua Skill Loadout — CHỈ dùng cho skill "đóng khung"
  // theo profession (Phàm Nhân's Trảm, xem App.vue's onMounted()).
  equipSkillWithoutSlot(skillId: string): boolean {
    return this.skillSystem.equipWithoutSlot(skillId)
  }

  unequipSkill(skillId: string): boolean {
    return this.skillSystem.unequip(skillId)
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
    // Formation chỉ có hiệu lực khi CÓ vũ khí đang trang bị (MASTER
    // SPEC Mục XVI, Phase 9 — state ở slot, nhưng vẫn cần slot đó
    // đang thật sự "mặc" gì để coi như kích hoạt).
    const socketedFormation = this.equipmentBag.getEquippedInSlot('weapon')
      ? this.equipmentSlotManager.get('weapon').socketedFormation
      : undefined

    return [
      ...this.buffSystem.getActiveModifiers(),
      // Core Loop Foundation checklist (Mục SKILL) — qua
      // getScaledPassiveModifiers() thay vì đọc thẳng
      // skill.passiveModifiers, để áp Specialization + level scaling.
      ...this.skillSystem.getScaledPassiveModifiers(),
      ...(socketedFormation?.modifiers ?? []),
      ...(player ? this.getTechniqueTierModifiers(player) : []),
    ]
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
  private getTechniqueTierModifiers(player: PlayerData): StatModifier[] {
    const technique = this.techniqueManager.getEquipped()

    const effect = technique?.tierEffects?.[
      getTechniqueTier(technique.insight ?? 0, getTechniqueInsightTotalRequired(technique))
    ]

    if (!effect) {
      return []
    }

    const modifiers: StatModifier[] = []

    if (effect.attackFlat !== undefined) {
      modifiers.push({ id: `technique-tier:${technique!.id}:attack`, sourceId: technique!.id, sourceType: 'technique', stat: 'attack', flat: effect.attackFlat })
    }

    if (effect.defenseFlat !== undefined) {
      modifiers.push({ id: `technique-tier:${technique!.id}:defense`, sourceId: technique!.id, sourceType: 'technique', stat: 'defense', flat: effect.defenseFlat })
    }

    if (effect.maxMpPercent !== undefined) {
      modifiers.push({ id: `technique-tier:${technique!.id}:maxMp`, sourceId: technique!.id, sourceType: 'technique', stat: 'maxMp', percent: effect.maxMpPercent })
    }

    if (effect.manaRegenPercent !== undefined) {
      modifiers.push({ id: `technique-tier:${technique!.id}:manaRegen`, sourceId: technique!.id, sourceType: 'technique', stat: 'manaRegenPerSecond', percent: effect.manaRegenPercent })
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
   * Đột Phá Trúc Cơ (mục 6 spec): mốc tối thiểu để nút "TRÚC CƠ" xuất
   * hiện song song nút "Đột Phá" thường — ngưỡng Nhân Đạo (realmLevel
   * >= 9). CHỈ áp dụng cho qi_refining — vẫn giữ hệ Căn Cơ 4-tier
   * riêng, KHÔNG đổi (xem CultivationSystem.breakthrough()'s guard).
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
   * không hỗ trợ material làm kết quả) — cùng pattern
   * Cùng pattern refineBuiCot(): check đủ Linh Thạch rồi trừ và cấp
   * thẳng material. Phân Giải equipment là luồng huỷ item riêng.
   */
  canCraftBreakthroughToken(targetRealmId: string, player: PlayerData): boolean {
    const requirement = BREAKTHROUGH_REQUIREMENTS[targetRealmId]

    return requirement !== undefined && player.spiritStone >= requirement.spiritStoneCost
  }

  craftBreakthroughToken(targetRealmId: string, player: PlayerData): boolean {
    if (!this.canCraftBreakthroughToken(targetRealmId, player)) {
      return false
    }

    const requirement = BREAKTHROUGH_REQUIREMENTS[targetRealmId]!

    player.spiritStone -= requirement.spiritStoneCost

    this.materialBag.add(this.materialRegistry.get(requirement.materialId), 1)

    return true
  }

  // =========================
  // EQUIPMENT
  // =========================

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

  enhanceItem(instanceId: string, player: PlayerData): boolean {
    return this.equipmentSystem.enhance(
      instanceId,
      player,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  getEnhanceCost(instanceId: string) {
    return this.equipmentSystem.getEnhanceCost(instanceId, this.equipmentBag, this.equipmentRegistry, this.equipmentSlotManager)
  }

  washItem(instanceId: string): boolean {
    return this.equipmentSystem.wash(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  refineItem(instanceId: string, player: PlayerData): boolean {
    return this.equipmentSystem.refine(
      instanceId,
      player,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  forgeItem(instanceId: string): boolean {
    return this.equipmentSystem.forge(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  getForgeCost(instanceId: string) {
    const instance = this.equipmentBag.get(instanceId)

    if (!instance) {
      return []
    }

    return this.equipmentSystem.getForgeCost(this.equipmentRegistry.get(instance.itemId), instance.forgePoints)
  }

  upgradeItemQuality(instanceId: string): boolean {
    return this.equipmentSystem.upgradeQuality(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
    )
  }

  upgradeItemRealm(instanceId: string, player: PlayerData): boolean {
    return this.equipmentSystem.upgradeRealm(
      instanceId,
      player,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  addEquipmentAffix(instanceId: string): boolean {
    return this.equipmentSystem.addAffix(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  upgradeEquipmentAffixTier(instanceId: string, affixIndex: number): boolean {
    return this.equipmentSystem.upgradeAffixTier(
      instanceId,
      affixIndex,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  private static readonly SMELT_BUI_COT_YIELD = 2

  private static readonly REFINE_BUI_COT_COST = 5
  private static readonly REFINE_SPIRIT_STONE_COST = 10

  /**
   * Phân Giải trang bị: chỉ nhận instance chưa mặc, xoá vĩnh viễn khỏi
   * EquipmentBag và thu Bụi Cốt. Không tạo item mới và không tiêu nguyên liệu.
   */
  smeltEquipment(instanceId: string): boolean {
    const instance = this.equipmentBag.get(instanceId)

    if (!instance || instance.equipped || !this.materialRegistry.has('bui_cot')) {
      return false
    }

    this.equipmentBag.remove(instanceId)
    this.materialBag.add(this.materialRegistry.get('bui_cot'), GameManager.SMELT_BUI_COT_YIELD)

    return true
  }

  /**
   * Tinh Luyện Cốt (tunghematandsuch mục 12) — chuyển đổi đơn giản
   * Bụi Cốt + Linh Thạch, KHÔNG qua Recipe (chỉ 1 conversion, không
   * đáng thêm 'material' vào RecipeResultType). CHƯA có consumer nào
   * tiêu thụ Tinh Luyện Cốt trong lượt này (tài liệu chỉ liệt kê
   * use-case tương lai chưa có mechanic cụ thể) — method này chỉ đảm
   * bảo có NGUỒN THU thật, tránh mint sẵn material không ai lấy được.
   */
  refineBuiCot(player: PlayerData): boolean {
    if (
      !this.materialBag.has('bui_cot', GameManager.REFINE_BUI_COT_COST) ||
      player.spiritStone < GameManager.REFINE_SPIRIT_STONE_COST
    ) {
      return false
    }

    this.materialBag.remove('bui_cot', GameManager.REFINE_BUI_COT_COST)

    player.spiritStone -= GameManager.REFINE_SPIRIT_STONE_COST

    this.materialBag.add(this.materialRegistry.get('tinh_luyen_cot'), 1)

    return true
  }

  canSmeltEquipment(instanceId: string): boolean {
    const instance = this.equipmentBag.get(instanceId)

    return Boolean(instance && !instance.equipped && this.materialRegistry.has('bui_cot'))
  }

  canRefineBuiCot(player: PlayerData): boolean {
    return (
      this.materialBag.has('bui_cot', GameManager.REFINE_BUI_COT_COST) &&
      player.spiritStone >= GameManager.REFINE_SPIRIT_STONE_COST
    )
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

  socketFormation(formationId: string, instanceId: string): boolean {
    return this.formationSystem.socket(formationId, instanceId, this.formationBag, this.formationRegistry)
  }

  // Không còn nhận instanceId (MASTER SPEC Mục XVI, Phase 9) — trận
  // pháp gắn theo slot 'weapon', không theo item cụ thể nào.
  unsocketFormation(): boolean {
    return this.formationSystem.unsocket(this.formationBag, this.formationRegistry)
  }

  // =========================
  // RECIPE / CRAFTING (Đan/Phù/Trận — Khí dùng EquipmentSystem, không qua đây)
  // =========================

  getRecipesByType(resultType: RecipeResultType): Recipe[] {
    return this.recipeRegistry.getAll().filter(recipe => recipe.resultType === resultType)
  }

  /**
   * `pham` thật của thành phẩm (Pill/Talisman/Formation) — naming-
   * principles pass (2026-08-14) thay thế hẳn `getRecipeResultGrade()`/
   * `CraftQuality.gradeToCraftQuality()` cũ (đã xoá): trước đây cần 1
   * hàm chuyển đổi grade -> nhãn EquipmentQuality để hiện UI nhất quán,
   * giờ `pham` đã LÀ nhãn thống nhất thật (Pham.ts, dùng chung với
   * Equipment Rarity) nên không cần lớp convert nào nữa — đọc thẳng.
   */
  getRecipeResultGrade(recipe: Recipe): ItemGrade | null {
    switch (recipe.resultType) {
      case 'pill':
        return this.pillRegistry.has(recipe.resultId) ? this.pillRegistry.get(recipe.resultId).grade : null

      case 'talisman':
        return this.talismanRegistry.has(recipe.resultId) ? this.talismanRegistry.get(recipe.resultId).grade : null

      case 'formation':
        return this.formationRegistry.has(recipe.resultId) ? this.formationRegistry.get(recipe.resultId).grade : null

      default:
        return null
    }
  }

  /**
   * Template THẬT của thành phẩm (Pill/Talisman/Formation) — UI redesign
   * Step 15/17/18 (RecipeCraftingView.vue's cauldron vessel, spec mục
   * 18/20/21 "Result → ItemSlot → Tooltip") cần icon/description thật
   * thay vì chỉ chữ cái đầu tên. Cùng switch pattern với
   * getRecipeResultGrade() ở trên — không tách hàm helper chung vì mỗi
   * nhánh trả về TYPE khác nhau (union caller phải tự narrow theo
   * recipe.resultType nếu cần field riêng từng loại).
   */
  getRecipeResultTemplate(recipe: Recipe): Pill | Talisman | Formation | null {
    switch (recipe.resultType) {
      case 'pill':
        return this.pillRegistry.has(recipe.resultId) ? this.pillRegistry.get(recipe.resultId) : null

      case 'talisman':
        return this.talismanRegistry.has(recipe.resultId) ? this.talismanRegistry.get(recipe.resultId) : null

      case 'formation':
        return this.formationRegistry.has(recipe.resultId) ? this.formationRegistry.get(recipe.resultId) : null

      default:
        return null
    }
  }

  // BUILDing spec mục 15-16 — Building crafting-station (Đan Phòng/
  // Trận Đài/Phù Viện) feed modifier vào Function xử lý qua đây. Khí
  // Đường (equipment_hall) KHÔNG dùng hàm này — Enhance/Wash/Refine
  // không đi qua CraftingSystem (xem EquipmentHallPanel.vue's
  // isProcessing, độ trễ cố định ACTION_DURATION_MS, không phải
  // Building-modified). Building chưa xây (không nên xảy ra, panel đã
  // chặn qua BuildingConstructionGate.vue) trả về default an toàn (1
  // slot, không bonus) thay vì throw.
  private readonly CRAFT_BUILDING_ID_BY_RESULT_TYPE: Record<RecipeResultType, string> = {
    pill: 'pill_room',
    talisman: 'talisman_institute',
    formation: 'formation_altar',
  }

  getCraftModifiers(resultType: RecipeResultType): CraftModifiers {
    const buildingId = this.CRAFT_BUILDING_ID_BY_RESULT_TYPE[resultType]

    const instance = this.buildingManager.getByBuildingId(buildingId)

    if (!instance) {
      return { timeReductionPercent: 0, qualityBonusPercent: 0, concurrentJobSlots: 1 }
    }

    return this.buildingSystem.getCraftModifiers(instance, this.buildingRegistry.get(buildingId))
  }

  getActiveCrafts(resultType: RecipeResultType): ActiveCraft[] {
    return this.craftingManager.getAllFor(resultType)
  }

  canStartCraft(recipe: Recipe, player: PlayerData): boolean {
    return this.craftingSystem.canStart(recipe, player, this.getCraftModifiers(recipe.resultType).concurrentJobSlots)
  }

  /**
   * Trả về craftId của lượt vừa bắt đầu (null nếu thất bại) — cần để
   * UI theo dõi/thu hoạch ĐÚNG job slot này (nhiều lượt cùng
   * resultType có thể chạy song song, xem CraftingManager.ts).
   */
  startCraft(recipeId: string, player: PlayerData, currentTime = Date.now() / 1000): string | null {
    if (!this.recipeRegistry.has(recipeId)) {
      return null
    }

    const recipe = this.recipeRegistry.get(recipeId)

    const maxSlots = this.getCraftModifiers(recipe.resultType).concurrentJobSlots

    return this.craftingSystem.start(recipe, player, currentTime, maxSlots)
  }

  getCraftingProgress(craftId: string, currentTime = Date.now() / 1000): number {
    const active = this.craftingManager.getById(craftId)

    if (!active) {
      return 0
    }

    const modifiers = this.getCraftModifiers(active.resultType)

    return this.craftingSystem.getProgress(
      craftId,
      this.recipeRegistry.get(active.recipeId),
      currentTime,
      modifiers.timeReductionPercent,
    )
  }

  /**
   * Thu thành phẩm — CraftingSystem chỉ trả lại `Recipe` khi đã đủ
   * giờ (không biết về PillBag/TalismanBag/FormationBag), GameManager
   * route sản phẩm vào đúng bag theo `resultType` ở đây. Building
   * qualityBonusPercent (mục 15) — roll cơ hội +1 thành phẩm dư, xem
   * ghi chú scoping trong Beta plan (không có hệ thống quality-roll
   * cho item craft được, đây là cách hiện thực hoá "phẩm chất" trung
   * thực nhất mà không phải bịa thêm 1 hệ thống mới).
   */
  collectCraft(craftId: string, currentTime = Date.now() / 1000): boolean {
    const active = this.craftingManager.getById(craftId)

    if (!active) {
      return false
    }

    const recipe = this.recipeRegistry.get(active.recipeId)

    const modifiers = this.getCraftModifiers(active.resultType)

    const collected = this.craftingSystem.collect(craftId, recipe, currentTime, modifiers.timeReductionPercent)

    if (!collected) {
      return false
    }

    let amount = collected.resultAmount

    if (Math.random() * 100 < modifiers.qualityBonusPercent) {
      amount += 1
    }

    switch (collected.resultType) {
      case 'pill':
        if (this.pillRegistry.has(collected.resultId)) {
          this.pillBag.add(this.pillRegistry.get(collected.resultId), amount)
        }
        break

      case 'talisman':
        if (this.talismanRegistry.has(collected.resultId)) {
          this.talismanBag.add(this.talismanRegistry.get(collected.resultId), amount)
        }
        break

      case 'formation':
        if (this.formationRegistry.has(collected.resultId)) {
          this.formationBag.add(this.formationRegistry.get(collected.resultId), amount)
        }
        break
    }

    return true
  }

  // =========================
  // PILL
  // =========================

  usePill(pillId: string, target: PillTarget, player: PlayerData): boolean {
    if (!this.pillBag.has(pillId, 1)) {
      return false
    }

    const pill = this.pillRegistry.get(pillId)

    const cap = getCurrentRealm(player.realmId).attributeCap

    if (!this.pillSystem.canUse(pill, player, cap)) {
      return false
    }

    const permanentModifiers = this.pillSystem.use(pill, target)

    for (const modifier of permanentModifiers) {
      const existing = player.modifiers.find(candidate => candidate.id === modifier.id)

      if (existing) {
        existing.flat = (existing.flat ?? 0) + (modifier.flat ?? 0)
      } else {
        player.modifiers.push(modifier)
      }
    }

    this.pillBag.remove(pillId, 1)

    return true
  }

  // =========================
  // TALISMAN
  // =========================

  /**
   * Phù chú KHÔNG dùng trong combat — áp thẳng lên 1 EquipmentInstance
   * để mở thêm slot chỉ số phụ (xem TalismanSystem.applyToEquipment()).
   */
  applyTalisman(talismanId: string, instanceId: string): boolean {
    if (!this.talismanBag.has(talismanId, 1)) {
      return false
    }

    const talisman = this.talismanRegistry.get(talismanId)

    const applied = this.talismanSystem.applyToEquipment(
      talisman,
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.equipmentSlotManager,
      this.affixRegistry,
    )

    if (!applied) {
      return false
    }

    // Home Hub Phase 2 — ghi nhận Phù Chú đã áp vào SLOT (không phải
    // item) để hiện badge trên EquipmentPaperdoll.vue, đối xứng
    // socketedFormation. Đặt ở đây (không phải trong TalismanSystem)
    // vì cần instance.slot — instance vẫn còn hợp lệ do applied=true.
    const instance = this.equipmentBag.get(instanceId)

    if (instance) {
      this.equipmentSlotManager.get(instance.slot).appliedTalismanIds.push(talismanId)
    }

    this.talismanBag.remove(talismanId, 1)

    return true
  }

  // =========================
  // EXPLORATION
  // =========================

  startExploration(explorationId: string, player: PlayerData, currentTime = Date.now() / 1000): boolean {
    const entry = this.explorationData.get(explorationId)

    if (!entry) {
      return false
    }

    const maxConcurrent = getMaxConcurrentExplorations(getRealmIndex(player.realmId))

    if (this.explorationManager.getAll().length >= maxConcurrent) {
      return false
    }

    return this.explorationSystem.start(entry.exploration, currentTime)
  }

  getMaxConcurrentExplorations(player: PlayerData): number {
    return getMaxConcurrentExplorations(getRealmIndex(player.realmId))
  }

  getRunningExplorationCount(): number {
    return this.explorationManager.getAll().length
  }

  collectExploration(explorationId: string, currentTime = Date.now() / 1000): ExplorationResult | null {
    const entry = this.explorationData.get(explorationId)

    if (!entry) {
      return null
    }

    return this.explorationSystem.collect(entry.exploration, entry.rewards, currentTime)
  }

  getExplorationDefinitions(): ExplorationDataEntry[] {
    return Array.from(this.explorationData.values())
  }

  // =========================
  // BUILDING
  // =========================

  getBuildingDefinitions(): Building[] {
    return this.buildingRegistry.getAll()
  }

  buildBuilding(buildingId: string, player: PlayerData, currentTime = Date.now() / 1000) {
    return this.buildingSystem.build(
      buildingId,
      this.buildingRegistry,
      this.buildingManager,
      player,
      this.materialBag,
      currentTime,
    )
  }

  upgradeBuilding(instanceId: string): boolean {
    return this.buildingSystem.upgrade(instanceId, this.buildingRegistry, this.buildingManager, this.materialBag)
  }

  // Linh Tuyền (producesSpiritStone) đổ sản lượng thẳng vào
  // player.spiritStone thay vì materialBag — claim() cần player, xem
  // BuildingSystem.ts.
  collectBuilding(instanceId: string, player: PlayerData, currentTime = Date.now() / 1000): number {
    return this.buildingSystem.claim(
      instanceId,
      this.buildingRegistry,
      this.buildingManager,
      this.materialBag,
      this.materialRegistry,
      this.processingRecipeRegistry,
      currentTime,
      player,
    )
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
      this.materialBag,
      this.processingRecipeRegistry,
    )
  }

  getProcessingRecipe(recipeId: string): ProcessingRecipe {
    return this.processingRecipeRegistry.get(recipeId)
  }

  // =========================
  // GARDEN (Linh Thảo Viên — 9 ô gieo hạt, xem GardenSystem.ts)
  // =========================

  getGardenPlots(instanceId: string, currentTime = Date.now() / 1000) {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return []
    }

    return this.gardenSystem.getPlots(instance, this.buildingRegistry.get(instance.buildingId), currentTime)
  }

  plantGardenSeed(instanceId: string, plotIndex: number, currentTime = Date.now() / 1000): boolean {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return false
    }

    return this.gardenSystem.plant(instance, this.buildingRegistry.get(instance.buildingId), plotIndex, this.materialBag, currentTime)
  }

  harvestGardenPlot(instanceId: string, plotIndex: number, currentTime = Date.now() / 1000): boolean {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return false
    }

    return this.gardenSystem.harvest(
      instance,
      this.buildingRegistry.get(instance.buildingId),
      plotIndex,
      this.materialBag,
      this.materialRegistry,
      currentTime,
    )
  }

  harvestAllGardenPlots(instanceId: string, currentTime = Date.now() / 1000): number {
    const instance = this.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.gardenSystem.harvestAll(instance, this.buildingRegistry.get(instance.buildingId), this.materialBag, this.materialRegistry, currentTime)
  }

  // =========================
  // BATTLE
  // =========================

  spawnEnemy(template: Enemy): Enemy {
    return this.enemySystem.spawn(template)
  }

  startBattle(player: CombatEntity, enemy: Enemy) {
    const enemyEntity = enemyToCombatEntity(this.enemySystem.spawn(enemy))

    applySpawnLaneRule(enemyEntity)

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
    // trận kế tiếp; không đồng bộ lại CombatEntity đang chiến đấu.
    const skillLevels = Object.fromEntries(
      this.skillManager.getAll().map(skill => [skill.id, skill.level]),
    )
    const playerEntity = playerToCombatEntity(
      player,
      playerStats,
      this.skillSystem.getSkillRuntimeStats(),
      skillLevels,
    )

    this.startBattle(playerEntity, enemy)

    this.battleLoot.setSession(
      createPlayerRewardReceiver(player, amount => this.gainEquippedTechniqueInsight(amount)),
      player,
    )
  }

  getBattle(): Battle | null {
    return this.battleSystem.getBattle()
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
  startTribulation(player: PlayerData, playerStats: Stats, targetRealmId: string, foundationType?: FoundationType): boolean {
    const started = this.tribulation.start(player, playerStats, targetRealmId, foundationType)

    if (started) {
      this.battleLoot.beginTribulation(player)
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

  startStage(player: PlayerData, playerStats: Stats, stage: Stage, repeatContinuously = false): boolean {
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
      if (!this.skillManager.has(skill.id)) {
        this.skillManager.add(skill)
      }
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

    for (const entry of save.talismans) {
      if (this.talismanRegistry.has(entry.talismanId)) {
        this.talismanBag.add(this.talismanRegistry.get(entry.talismanId), entry.amount)
      }
    }

    for (const entry of save.formations) {
      if (this.formationRegistry.has(entry.formationId)) {
        this.formationBag.add(this.formationRegistry.get(entry.formationId), entry.amount)
      }
    }

    for (const instance of save.equipment) {
      // Item template cũ đã bị xoá theo equipment rework; bỏ hẳn instance
      // mồ côi thay vì để restoreModifiers truy cập registry và crash.
      if (this.equipmentRegistry.has(instance.itemId)) {
        this.equipmentBag.add(instance)
      }
    }

    // MASTER SPEC Mục XVI (Phase 9) — slot state (enhance/formation/
    // bonus affix slots) PHẢI nạp trước refreshModifiers() bên dưới
    // (áp dụng enhanceLevel đúng ngay từ đầu, không phải mặc định 0).
    this.equipmentSlotManager.restore(save.equipmentSlots)

    // ModifierSystem nội bộ của equipmentSystem không tự phục hồi
    // theo EquipmentBag vừa nạp — phải build lại thủ công.
    this.equipmentSystem.refreshModifiers(this.equipmentBag, this.equipmentSlotManager, this.affixRegistry)

    this.explorationManager.restore(save.explorations)

    this.craftingManager.restore(save.crafts)

    this.buildingManager.restore(save.buildings)

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

    this.buffSystem.update(deltaSeconds)

    // cooldownReduction đọc từ battle.player.stats (CombatEntity) đang
    // sống trong trận nếu có — ngoài combat (menu/màn hình cảnh giới)
    // không có battle nào thì mặc định 0, khớp hành vi cũ.
    const activeBattle = this.battleSystem.getBattle()

    this.skillSystem.update(deltaSeconds, activeBattle?.player.stats.cooldownReduction ?? 0)

    this.passiveSystem.tick(deltaSeconds)
    this.formationSystem.tick(deltaSeconds)

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
