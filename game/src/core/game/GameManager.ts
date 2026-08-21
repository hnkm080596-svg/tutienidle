import { EventBus } from '../events/EventBus'

import { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'
import { MissileManager } from '../combat/missile/MissileManager'
import { MissileSystem } from '../combat/missile/MissileSystem'

import { BattleSystem } from '../battle/BattleSystem'
import type { Battle } from '../battle/Battle'

import type { FoundationType } from '../breakthrough/FoundationType'

import { investTinhHoa, computeBreakthroughGrade } from '../realm/LuyenTheSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/LuyenThe'
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
import { EquipmentSetRegistry } from '../equipment/EquipmentSetRegistry'
import type { EquipmentSet } from '../equipment/EquipmentSet'
import { AffixRegistry } from '../equipment/AffixRegistry'
import type { Affix } from '../equipment/Affix'

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
import type { Pham } from '../item/Pham'

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
import { enemyToCombatEntity, createEliteVariant, createBossVariant } from '../enemy/Enemy'
import type { Enemy, EnemyItemDrop } from '../enemy/Enemy'
import type { NotificationEvent } from '../notification/NotificationEvent'

import { StageManager } from '../stage/StageManager'
import { StageSystem } from '../stage/StageSystem'
import type { Stage } from '../stage/Stage'
import { ZoneRegistry } from '../stage/ZoneRegistry'
import type { Zone } from '../stage/Zone'

import { rollChance } from '../reward/DropRoll'

import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import { createEmptyBattleRewardSummary, type BattleRewardSummary, type BattleRewardItemKind } from '../reward/BattleRewardSummary'

import { playerToCombatEntity, createPlayerRewardReceiver } from '../player/Player'
import type { PlayerData } from '../player/Player'
import type { MainStatKey } from '../stats/StatTypes'
import { getMainStatCap } from '../stats/StatCap'
import { getTechniqueTier } from '../technique/TechniqueTier'
import { getSkillLoadoutSlotCount } from '../skill/SkillLoadoutSlots'
import { CULTIVATION_PATH_KITS } from '../player/CultivationPathKit'
import type { CultivationPathId } from '../player/CultivationPathKit'

import { getCurrentRealm, getRealmIndex, getMaxConcurrentExplorations, getNextRealm } from '../realm/realmSystem'
import { BREAKTHROUGH_REQUIREMENTS } from '../breakthrough/BreakthroughRequirement'

import type { GameSave } from '../../services/save/SaveSystem'

import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'

export interface ExplorationDataEntry {
  exploration: Exploration
  rewards: ExplorationMaterialReward[]
}

/**
 * GameManager KHÔNG chứa business logic.
 *
 * Nhiệm vụ duy nhất:
 * 1. Khởi tạo và giữ instance của mọi Manager/System.
 * 2. Điều phối update(deltaSeconds) mỗi tick cho các system
 *    có yếu tố thời gian (Buff, Skill, Battle).
 * 3. Tổng hợp modifier từ nhiều nguồn (buff/technique/skill)
 *    để đưa vào StatCalculator — đây là chỗ duy nhất nên làm
 *    việc "gộp modifier từ nhiều hệ thống", tránh mỗi nơi tự
 *    gộp một kiểu.
 *
 * Toàn bộ logic thật (điều kiện học skill, cách tính reward...)
 * vẫn nằm trong các System tương ứng như cũ.
 */

// Đột Phá Trúc Cơ (Phase 4) — id enemy Kiếp ứng với từng Căn Cơ (xem
// data/enemy/Tribulations.ts, đăng ký qua registerEnemyTemplates()
// giống mọi Enemy khác — GameManager không import thẳng data file,
// giữ đúng kiến trúc "data đăng ký từ ngoài vào" hiện có).
const TRIBULATION_ENEMY_ID_BY_FOUNDATION: Record<FoundationType, string> = {
  human: 'tribulation_human',
  earth: 'tribulation_earth',
  heaven: 'tribulation_heaven',
  great_dao: 'tribulation_great_dao',
}

// Đột Phá tổng quát (2026-08-16) — id enemy Kiếp cho MỌI đại cảnh giới
// TRỪ 'foundation' (dùng map Căn Cơ 4-tier ở trên, không đổi) — không
// có hệ thống tier, chỉ 1 quái Kiếp/cảnh giới (xem
// data/enemy/Tribulations.ts's TRIBULATION_GOLDEN_CORE trở đi).
const TRIBULATION_ENEMY_ID_BY_REALM: Record<string, string> = {
  golden_core: 'tribulation_golden_core',
  nascent_soul: 'tribulation_nascent_soul',
  soul_transformation: 'tribulation_soul_transformation',
  void_refinement: 'tribulation_void_refinement',
  body_integration: 'tribulation_body_integration',
  mahayana: 'tribulation_mahayana',
  tribulation: 'tribulation_tribulation',
}

// Trạng thái Tribulation ĐANG diễn ra — targetRealmId là cảnh giới sẽ
// bước vào NẾU thắng, foundationType chỉ có mặt khi targetRealmId ===
// 'foundation' (hệ Căn Cơ 4-tier riêng, xem FoundationResolver.ts).
export interface ActiveTribulation {
  targetRealmId: string

  foundationType?: FoundationType
}

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

  readonly missileManager = new MissileManager()
  readonly missileSystem = new MissileSystem(this.missileManager, this.eventBus)

  readonly buffManager = new BuffManager()
  readonly buffSystem = new BuffSystem(this.buffManager)
  readonly buffRegistry = new BuffRegistry()

  readonly ailmentRegistry = new AilmentRegistry()

  readonly skillManager = new SkillManager()
  readonly skillSystem = new SkillSystem(this.skillManager)
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
    this.missileSystem,
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

  // Cơ chế Set (2026-08-15), xem core/equipment/EquipmentSet.ts.
  readonly equipmentSetRegistry = new EquipmentSetRegistry()

  registerEquipmentSets(sets: EquipmentSet[]) {
    for (const set of sets) {
      if (!this.equipmentSetRegistry.has(set.id)) {
        this.equipmentSetRegistry.register(set)
      }
    }
  }

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

  // Receiver để phát thưởng khi battle hiện tại kết thúc thắng —
  // xem startBattleWithPlayer() và grantBattleRewardIfNeeded().
  private activeReceiver: RewardReceiver | null = null

  // PlayerData của trận đang diễn ra — cần cho việc roll equipment
  // rớt ra (chỉ số chính scale theo cảnh giới người chơi).
  private activePlayer: PlayerData | null = null

  // Beta Phase 4 (Notification/UX) — hàng đợi toast phát sinh TRONG
  // GameManager (hiện chỉ loot, xem grantItemDrops()) — GameManager
  // là plain class không phụ thuộc Vue, Vue layer (App.vue's tick())
  // tự rút ra mỗi tick qua drainNotifications() rồi đẩy vào
  // stores/notification.ts. Nguồn toast khác (upgrade/craft/save) đã
  // ở Vue layer sẵn, gọi thẳng store, không qua hàng đợi này.
  private pendingNotifications: NotificationEvent[] = []

  // Combat UI Redesign — tích luỹ EXP/tu vi/Linh Thạch/vật phẩm rớt
  // TRONG trận hiện tại, để CombatVictoryPanel/CombatDefeatPanel hiện
  // lại lúc kết thúc (khác pendingNotifications — cái đó là toast rời
  // rạc, bị drain/xoá mỗi tick). Reset mỗi khi 1 trận mới bắt đầu, xem
  // startBattle().
  private battleRewardSummary: BattleRewardSummary = createEmptyBattleRewardSummary()

  // Đột Phá tổng quát (2026-08-16) — trận Độ Kiếp ĐANG diễn ra (mọi
  // đại cảnh giới, không riêng Trúc Cơ nữa), null nếu không phải
  // Tribulation (stage/menu bình thường). Ephemeral — KHÔNG persist
  // vào save (giống activeReceiver/activePlayer), xem
  // startTribulation()/updateTribulationProgress().
  private activeTribulation: ActiveTribulation | null = null

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
  private skillTemplates = new Map<string, Skill>()
  private techniqueTemplates = new Map<string, Technique>()

  // Enemy template tra theo id (dùng bởi StageSystem khi chọn quái
  // kế tiếp để spawn) — cùng pattern skillTemplates/techniqueTemplates,
  // KHÁC EnemyManager (chỉ chứa instance đã spawn, có id riêng từng
  // con — xem EnemySystem.spawn()).
  private enemyTemplates = new Map<string, Enemy>()

  // Stage template tra theo id — cùng pattern enemyTemplates.
  private stageTemplates = new Map<string, Stage>()

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
      this.skillTemplates.set(skill.id, skill)
    }
  }

  registerTechniqueTemplates(techniques: Technique[]) {
    for (const technique of techniques) {
      this.techniqueTemplates.set(technique.id, technique)
    }
  }

  registerEnemyTemplates(enemies: Enemy[]) {
    for (const enemy of enemies) {
      this.enemyTemplates.set(enemy.id, enemy)
    }
  }

  registerStages(stages: Stage[]) {
    for (const stage of stages) {
      this.stageTemplates.set(stage.id, stage)
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
   * hàm đó tự xử lý MỌI thứ không cần registry (trừ skillPoints, đánh
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
   * CultivationSystem.breakthrough()'s guard chặn realmId === 'pham_nhan').
   * Nếu player đang ở Phàm Nhân lúc chọn, atomically chuyển luôn sang
   * qi_refining tầng 1 — 3 hàm gọi sau đó GIỐNG HỆT useBreakthrough.ts/
   * useTribulation.ts gọi sau mọi lần đột phá đại cảnh giới.
   */
  chooseCultivationPath(pathId: CultivationPathId, player: PlayerData): boolean {
    if (player.cultivationPath) {
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
      this.purchaseNode(PHAP_TU_STARTER_NODE_ID, player)

      this.skillSystem.equipToSlot(PHAP_TU_STARTER_SKILL_ID, 0)
    }

    if (player.realmId === 'pham_nhan') {
      // Realm Passive & Pressure System (2026-08-20) — chốt Bậc Nhập
      // Đạo TRƯỚC khi grant, để Nhập Đạo (RealmPassives.ts) đọc đúng
      // giá trị cuối cùng của Luyện Thể tại thời điểm Lễ Nhập Môn.
      player.breakthroughGrade = computeBreakthroughGrade(player)

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      this.syncRealmPassive(player)
      this.syncRealmStatPassive(player)
      this.syncSkillLevelToRealm(player)
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

      return current ? this.skillSystem.unequip(current.id) : false
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
      // Skill rework (2026-08-21) — 19 field "Thế tài nguyên" sống trên
      // Skill, đồng bộ vào CombatEntity.stats mỗi tick, xem SkillSystem.
      // getSkillResourceStatModifiers().
      ...this.skillSystem.getSkillResourceStatModifiers(),
      ...(socketedFormation?.modifiers ?? []),
      // Cơ chế Set (2026-08-15) — mốc 2/4/6 món cùng setId đang trang
      // bị, xem EquipmentSystem.getActiveSetModifiers().
      ...this.equipmentSystem.getActiveSetModifiers(this.equipmentBag, this.equipmentRegistry, this.equipmentSetRegistry),
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

    const effect = technique?.tierEffects?.[getTechniqueTier(player.techniqueExperience)]

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
   * Luyện Thể đang dở — xem core/realm/LuyenTheSystem.ts. Trả về số
   * Tinh Hoa thật sự đã tiêu (0 nếu không còn tầng nào để đầu tư hoặc
   * không cầm Tinh Hoa nào).
   */
  investLuyenThe(player: PlayerData): number {
    const available = this.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)

    const consumed = investTinhHoa(player, available)

    if (consumed > 0) {
      this.materialBag.remove(TINH_HOA_PHAM_THE_MATERIAL_ID, consumed)
    }

    return consumed
  }

  /**
   * "Skill lớn theo cảnh giới, không combo" (2026-08-15) — mỗi lần
   * phá cảnh giới (tiểu hoặc đại), MỌI skill chủ động ĐANG trang bị
   * (đòn cơ bản + toàn bộ Skill Loadout, thay 4 category cố định cũ —
   * xem PLAN HOÀN CHỈNH mục 6/8) tự nâng level lên bằng realmLevel
   * hiện tại (trần ở maxLevel riêng của từng skill) — tái dùng NGUYÊN
   * VẸN công thức scale damage +5%/level đã có sẵn (SkillSystem.
   * getEffectiveSkill()), chỉ đổi THỨ điều khiển con số level: cảnh
   * giới thay vì (hoặc CỘNG THÊM, xem Math.max) cast-XP cày tay. CHỈ
   * TĂNG — realmLevel reset về 1 mỗi lần phá ĐẠI cảnh giới
   * (CultivationSystem.breakthrough()) nhưng level skill không bao
   * giờ tụt lại.
   */
  syncSkillLevelToRealm(player: PlayerData) {
    const basicSkill = this.skillManager.getBasicAttackSkill()

    const equippedActiveSkills: Skill[] = basicSkill
      ? [basicSkill, ...this.skillManager.getLoadoutSkills()]
      : this.skillManager.getLoadoutSkills()

    for (const skill of equippedActiveSkills) {
      skill.level = Math.max(skill.level, Math.min(skill.maxLevel, player.realmLevel))
    }
  }

  /**
   * Đột Phá Trúc Cơ (mục 6 spec): mốc tối thiểu để nút "TRÚC CƠ" xuất
   * hiện song song nút "Đột Phá" thường — ngưỡng Nhân Đạo (realmLevel
   * >= 9). CHỈ áp dụng cho qi_refining — vẫn giữ hệ Căn Cơ 4-tier
   * riêng, KHÔNG đổi (xem CultivationSystem.breakthrough()'s guard).
   */
  canTriggerFoundationBreakthrough(player: PlayerData): boolean {
    return player.realmId === 'qi_refining' && player.realmLevel >= 9
  }

  /**
   * Đột Phá tổng quát (2026-08-16) — mốc hiện nút chuyển đại cảnh giới
   * cho MỌI cảnh giới TRỪ Phàm Nhân (nghi lễ riêng: chọn Pháp Tu/Kiếm
   * Tu, xem chooseCultivationPath()) và Luyện Khí (dùng
   * canTriggerFoundationBreakthrough() riêng ở trên, hệ Căn Cơ 4-tier).
   * Điều kiện: đã chạm maxLevel của cảnh giới hiện tại VÀ còn cảnh
   * giới kế tiếp (không áp dụng ở Độ Kiếp — cảnh giới cuối cùng).
   */
  canTriggerRealmBreakthrough(player: PlayerData): boolean {
    if (player.realmId === 'pham_nhan' || player.realmId === 'qi_refining') {
      return false
    }

    const realm = getCurrentRealm(player.realmId)

    if (player.realmLevel < realm.maxLevel) {
      return false
    }

    return getNextRealm(player.realmId) !== null
  }

  /**
   * "Con đường bình thường" của Đột Phá tổng quát (2026-08-16, xem
   * core/breakthrough/BreakthroughRequirement.ts) — Đột Phá Lệnh luyện
   * trực tiếp bằng Linh Thạch, KHÔNG qua Recipe (RecipeResultType
   * không hỗ trợ material làm kết quả) — cùng pattern
   * refineBuiCot()/smeltEquipment() đã có: check đủ Linh Thạch rồi trừ
   * + cấp thẳng material.
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

  // "tunghematandsuch" pass (2026-08-14) — chi phí Luyện Khí (mint 1
  // instance MỚI từ ore) cố định, không đọc từ template (equipment
  // KHÔNG có field cost riêng cho hành động này, khác enhance/forge/
  // upgradeQuality... — action này tạo instance chứ không sửa 1
  // instance có sẵn nên không có "template.smeltCost" tự nhiên để gắn
  // vào). Số liệu khởi điểm, cần tinh chỉnh qua playtest.
  private static readonly SMELT_LINH_THIET_COST = 3
  private static readonly SMELT_SPIRIT_STONE_COST = 20
  private static readonly SMELT_BUI_COT_YIELD = 2

  private static readonly REFINE_BUI_COT_COST = 5
  private static readonly REFINE_SPIRIT_STONE_COST = 10

  /**
   * Luyện Khí (tunghematandsuch mục 10) — obtaining 1 equipment MỚI từ
   * Linh Thiết, KHÔNG qua Recipe/CraftingSystem (Equipment luôn là
   * thao tác instant, xem docs/item-design-reference.md mục 8) — chỉ
   * tái dùng equipmentSystem.createInstance() có sẵn (roll y hệt
   * đường rớt đồ từ quái) rồi cộng thêm Bụi Cốt như phế liệu, đúng
   * "Linh Thiết → Lò Luyện Khí → Khí + Bụi Cốt".
   */
  smeltEquipment(equipmentId: string, player: PlayerData, linhThietMaterialId: string): EquipmentInstance | null {
    if (!this.equipmentRegistry.has(equipmentId)) {
      return null
    }

    if (
      !this.materialBag.has(linhThietMaterialId, GameManager.SMELT_LINH_THIET_COST) ||
      player.spiritStone < GameManager.SMELT_SPIRIT_STONE_COST
    ) {
      return null
    }

    this.materialBag.remove(linhThietMaterialId, GameManager.SMELT_LINH_THIET_COST)

    player.spiritStone -= GameManager.SMELT_SPIRIT_STONE_COST

    const template = this.equipmentRegistry.get(equipmentId)
    const instance = this.equipmentSystem.createInstance(template, player, this.affixRegistry)

    this.equipmentBag.add(instance)

    this.materialBag.add(this.materialRegistry.get('bui_cot'), GameManager.SMELT_BUI_COT_YIELD)

    return instance
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

  canSmeltEquipment(player: PlayerData, linhThietMaterialId: string): boolean {
    return (
      this.materialBag.has(linhThietMaterialId, GameManager.SMELT_LINH_THIET_COST) &&
      player.spiritStone >= GameManager.SMELT_SPIRIT_STONE_COST
    )
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
  getRecipeResultPham(recipe: Recipe): Pham | null {
    switch (recipe.resultType) {
      case 'pill':
        return this.pillRegistry.has(recipe.resultId) ? this.pillRegistry.get(recipe.resultId).pham : null

      case 'talisman':
        return this.talismanRegistry.has(recipe.resultId) ? this.talismanRegistry.get(recipe.resultId).pham : null

      case 'formation':
        return this.formationRegistry.has(recipe.resultId) ? this.formationRegistry.get(recipe.resultId).pham : null

      default:
        return null
    }
  }

  /**
   * Template THẬT của thành phẩm (Pill/Talisman/Formation) — UI redesign
   * Step 15/17/18 (RecipeCraftingView.vue's cauldron vessel, spec mục
   * 18/20/21 "Result → ItemSlot → Tooltip") cần icon/description thật
   * thay vì chỉ chữ cái đầu tên. Cùng switch pattern với
   * getRecipeResultPham() ở trên — không tách hàm helper chung vì mỗi
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

    // Reset mặc định — startBattleWithPlayer() sẽ set lại receiver
    // thật ngay sau lệnh gọi này. Battle bắt đầu qua startBattle()
    // trực tiếp (không phải PlayerData) thì không có ai nhận thưởng
    // hay đồ rơi (equipment cần player để roll chỉ số chính).
    this.activeReceiver = null
    this.activePlayer = null

    // Stack passive (vd Linh Khí Cảm Ứng +công kích/đòn trúng) là
    // buff TRONG TRẬN — reset về 0 mỗi khi 1 trận mới bắt đầu, kể cả
    // khi Auto tự nối trận ngay lập tức (theo yêu cầu, khác thiết kế
    // permanent progression ban đầu).
    this.passiveSystem.resetStacks()

    this.battleRewardSummary = createEmptyBattleRewardSummary()

    this.battleSystem.start(player, enemyEntity)
  }

  getBattleRewardSummary(): BattleRewardSummary {
    return this.battleRewardSummary
  }

  /**
   * Tiện ích: bắt đầu trận đấu thẳng từ PlayerData thay vì phải
   * tự convert sang CombatEntity trước. `playerStats` truyền vào
   * phải là finalStats (đã cộng modifiers) — lấy từ
   * player store getter `finalStats`, không tính lại ở đây để
   * tránh 2 nơi tự gọi calculateStats() khác nhau.
   */
  startBattleWithPlayer(player: PlayerData, playerStats: Stats, enemy: Enemy) {
    const playerEntity = playerToCombatEntity(player, playerStats)

    this.startBattle(playerEntity, enemy)

    this.activeReceiver = createPlayerRewardReceiver(player)

    this.activePlayer = player
  }

  getBattle(): Battle | null {
    return this.battleSystem.getBattle()
  }

  /**
   * Độ Kiếp (mục 11 spec `breakthrough`) — khởi trận đấu với quái Kiếp,
   * bỏ qua Stage hoàn toàn (giống startBattle() nhận Enemy bất kỳ).
   * Enemy Kiếp phải đã được đăng ký qua registerEnemyTemplates().
   *
   * Đột Phá tổng quát (2026-08-16) — `foundationType` CHỈ truyền khi
   * targetRealmId === 'foundation' (tra TRIBULATION_ENEMY_ID_BY_FOUNDATION,
   * hệ Căn Cơ 4-tier cũ, không đổi); mọi targetRealmId khác tra
   * TRIBULATION_ENEMY_ID_BY_REALM (1 quái Kiếp/cảnh giới, không tier).
   */
  startTribulation(player: PlayerData, playerStats: Stats, targetRealmId: string, foundationType?: FoundationType): boolean {
    const enemyId = foundationType
      ? TRIBULATION_ENEMY_ID_BY_FOUNDATION[foundationType]
      : TRIBULATION_ENEMY_ID_BY_REALM[targetRealmId]

    if (!enemyId) {
      return false
    }

    const template = this.enemyTemplates.get(enemyId)

    if (!template) {
      return false
    }

    this.startBattleWithPlayer(player, playerStats, template)

    this.activeTribulation = { targetRealmId, foundationType }

    return true
  }

  getActiveTribulation(): ActiveTribulation | null {
    return this.activeTribulation
  }

  /**
   * Trận Kiếp KHÔNG đi qua Stage nên không ai tự set 'victory' khi hết
   * quái (khác updateStageProgress() — Stage-specific, xem class doc
   * BattleSystem.checkBattleEnd()) — hàm này bù lại đúng 1 việc đó.
   * 'defeat' đã tự đúng sẵn (BattleSystem.checkBattleEnd() set khi
   * player chết) — phần thưởng/phạt cho thắng/thua xử lý ở
   * useTribulation.ts (Phase 5), hàm này CHỈ phát hiện thắng.
   */
  private updateTribulationProgress() {
    if (!this.activeTribulation) {
      return
    }

    const battle = this.battleSystem.getBattle()

    if (!battle || battle.state !== 'fighting') {
      return
    }

    if (battle.enemies.length === 0) {
      battle.state = 'victory'

      this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })
    }
  }

  /**
   * Gọi sau khi useTribulation.ts (Phase 5) đã xử lý xong thắng/thua —
   * dọn activeTribulation để trận kế tiếp (Stage bình thường hoặc
   * TRÚC CƠ khác) không bị nhầm là đang giữa 1 Tribulation cũ.
   */
  clearActiveTribulation() {
    this.activeTribulation = null
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

    if (!battle || battle.state !== 'fighting') {
      return false
    }

    battle.state = 'defeat'

    this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })

    return true
  }

  // =========================
  // STAGE (wave spawn)
  // =========================

  /**
   * Điểm vào DUY NHẤT để bắt đầu 1 màn — thay hẳn việc gọi thẳng
   * startBattleWithPlayer() với 1 quái hardcode như trước. Quái đầu
   * tiên spawn ngay trong lệnh gọi này (qua startBattleWithPlayer()
   * có sẵn — tự nhiên tái dùng passiveSystem.resetStacks() bên trong,
   * đúng điểm reset stack 1 LẦN/màn chứ không phải mỗi wave).
   */
  startStage(player: PlayerData, playerStats: Stats, stage: Stage): boolean {
    if (!this.stageSystem.canStart(stage, player)) {
      return false
    }

    if (!this.stageManager.start(stage)) {
      return false
    }

    // Stage chỉ 1 quái + có bossEnemyId -> quái đầu tiên (spawnedCount
    // 0) CŨNG là quái CUỐI, phải là Boss ngay từ đầu.
    const firstEnemyTemplate = this.pickEnemyForSpawn(stage, stage.totalEnemyCount === 1)

    if (!firstEnemyTemplate) {
      this.stageManager.stop()

      return false
    }

    this.startBattleWithPlayer(player, playerStats, firstEnemyTemplate)

    return true
  }

  /**
   * Roll 1 entry trong enemyPool theo weight, tra template, rồi roll
   * riêng `eliteChance` của ĐÚNG entry đó — trúng thì trả bản Elite
   * (buff stat + eliteRewards nếu có, xem
   * core/enemy/Enemy.createEliteVariant()) thay vì bản thường. Dùng
   * chung cho quái ĐẦU (startStage) lẫn quái spawn giữa chừng
   * (updateStageProgress).
   *
   * `isFinalSpawn` — Core Loop Foundation checklist (Mục BOSS): lượt
   * spawn CUỐI của stage có bossEnemyId LUÔN LÀ Boss, bỏ qua roll
   * enemyPool/eliteChance hoàn toàn (Boss KHÔNG ngẫu nhiên như Elite).
   */
  private pickEnemyForSpawn(stage: Stage, isFinalSpawn: boolean): Enemy | undefined {
    if (isFinalSpawn && stage.bossEnemyId) {
      const bossTemplate = this.enemyTemplates.get(stage.bossEnemyId)

      if (bossTemplate) {
        return createBossVariant(bossTemplate)
      }
    }

    const entry = this.stageSystem.pickNextEnemyEntry(stage)
    const template = this.enemyTemplates.get(entry.enemyId)

    if (!template) {
      return undefined
    }

    if (entry.eliteChance && rollChance(entry.eliteChance)) {
      return createEliteVariant(template)
    }

    return template
  }

  /**
   * Gọi mỗi tick (sau grantBattleRewardIfNeeded() — cần battle.enemies
   * đã được dọn quái chết trước khi đếm "còn sống bao nhiêu"). Quản
   * lý toàn bộ vòng đời wave: spawn theo nhịp (SONG SONG, không đợi
   * quái cũ chết), spawn ngay nếu sân trống, và set 'victory' khi đã
   * spawn đủ + hết quái sống (BattleSystem không tự set 'victory'
   * nữa — xem BattleSystem.checkBattleEnd()).
   */
  private updateStageProgress(deltaSeconds: number) {
    const active = this.stageManager.get()

    if (!active) {
      return
    }

    const battle = this.battleSystem.getBattle()

    // Player chết (battle.state 'defeat') — BattleSystem.checkBattleEnd()
    // chỉ tự set 'defeat', KHÔNG tự dừng stage (không nên biết về
    // Stage, xem class doc). Phải dừng stageManager ở ĐÂY, không thì
    // active không bao giờ về null, khoá cứng nút "Chiến Đấu" vĩnh viễn.
    if (!battle || battle.state === 'defeat') {
      this.stageManager.stop()

      return
    }

    if (battle.state !== 'fighting') {
      return
    }

    const stage = this.stageTemplates.get(active.stageId)

    if (!stage) {
      return
    }

    const aliveCount = battle.enemies.length

    if (active.spawnedCount >= stage.totalEnemyCount) {
      if (aliveCount === 0) {
        battle.state = 'victory'

        this.stageManager.stop()

        // Chỉ chạy tới đây đúng 1 lần — tick kế battle.state đã là
        // 'victory' (!== 'fighting'), hàm này return sớm ở trên.
        this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })
      }

      return
    }

    active.spawnCountdown -= deltaSeconds

    // Sân trống quái giữa chừng thì spawn ngay (không đợi hết nhịp) —
    // tránh "chết thời gian" khi player out-DPS nhịp spawn mặc định.
    if (active.spawnCountdown > 0 && aliveCount > 0) {
      return
    }

    const nextEnemyTemplate = this.pickEnemyForSpawn(stage, active.spawnedCount === stage.totalEnemyCount - 1)

    if (!nextEnemyTemplate) {
      return
    }

    const nextEnemyEntity = enemyToCombatEntity(this.enemySystem.spawn(nextEnemyTemplate))

    this.battleSystem.spawnEnemyInto(battle, nextEnemyEntity)

    active.spawnedCount++

    active.spawnCountdown = stage.spawnIntervalSeconds
  }

  getStageProgress(): { spawned: number; total: number; alive: number } | null {
    const active = this.stageManager.get()

    if (!active) {
      return null
    }

    const stage = this.stageTemplates.get(active.stageId)

    if (!stage) {
      return null
    }

    return {
      spawned: active.spawnedCount,

      total: stage.totalEnemyCount,

      alive: this.battleSystem.getBattle()?.enemies.length ?? 0,
    }
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
      this.equipmentBag.add(instance)
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
    this.battleSystem.update(deltaSeconds)

    this.grantBattleRewardIfNeeded()
    this.updateStageProgress(deltaSeconds)
    this.updateTribulationProgress()
    this.updateBossSummons()
  }

  /**
   * Combat Rework Phase 4 (Boss Mechanics) — rút Battle.pendingSummons
   * (BattleSystem đẩy vào khi 1 TribulationPhase.summonEnemyIds trigger,
   * xem BattleSystem.updateTribulationPhases()) rồi spawn thật, cùng
   * pattern updateStageProgress() dùng cho wave spawn — GameManager là
   * nơi DUY NHẤT biết tra Enemy template theo id (enemyTemplates),
   * BattleSystem không nên biết.
   */
  private updateBossSummons() {
    const battle = this.battleSystem.getBattle()

    if (!battle || battle.pendingSummons.length === 0) {
      return
    }

    for (const enemyId of battle.pendingSummons) {
      const template = this.enemyTemplates.get(enemyId)

      if (!template) {
        continue
      }

      const summonedEntity = enemyToCombatEntity(this.enemySystem.spawn(template))

      this.battleSystem.spawnEnemyInto(battle, summonedEntity)
    }

    battle.pendingSummons = []
  }

  /**
   * Nhiều quái có thể chết cùng lúc/liên tục (wave) — quét TOÀN BỘ
   * battle.enemies mỗi tick, cấp thưởng cho con nào vừa chết mà chưa
   * xử lý (rewardGranted là cờ chống lặp thưởng), rồi dọn khỏi mảng.
   * Không còn gate theo battle.state === 'victory' như model 1v1 cũ —
   * quái chết giữa chừng lúc battle vẫn 'fighting' vẫn phải cấp
   * thưởng ngay, không đợi cả trận kết thúc.
   */
  private grantBattleRewardIfNeeded() {
    const battle = this.battleSystem.getBattle()

    if (!battle) {
      return
    }

    for (const battleEnemy of battle.enemies) {
      if (battleEnemy.entity.alive || battleEnemy.rewardGranted) {
        continue
      }

      battleEnemy.rewardGranted = true

      if (this.activeReceiver) {
        const enemy = this.enemySystem.get(battleEnemy.entity.id)

        if (enemy) {
          // Tu vi giờ CHỈ đến từ tu luyện (2026-08-20) — giết quái
          // KHÔNG còn cộng tu vi nữa, cố ý bỏ qua enemy.rewards.cultivation
          // ở đây (data field vẫn còn trong Enemies.ts nhưng không dùng).
          this.giveReward(this.activeReceiver, { ...enemy.rewards, cultivation: undefined })

          this.battleRewardSummary.experience += enemy.rewards.experience ?? 0
          this.battleRewardSummary.spiritStone += enemy.rewards.spiritStone ?? 0

          this.grantItemDrops(enemy.rewards.itemDrops)
        }
      }

      this.enemySystem.despawn(battleEnemy.entity.id)
    }

    // Dọn quái đã chết + đã cấp thưởng khỏi mảng — tránh phình vô hạn
    // qua nhiều wave trong cùng 1 stage. Sau bước này battle.enemies
    // chỉ còn quái đang sống, nên "còn quái không" = check .length.
    battle.enemies = battle.enemies.filter(battleEnemy => battleEnemy.entity.alive)
  }

  /**
   * Đồ rơi thẳng vào bag tương ứng ngay khi quái chết — không có
   * bước "nhặt" thủ công/loot window. Mỗi lần cộng thành công đẩy 1
   * toast 'loot' vào pendingNotifications (xem drainNotifications()).
   */
  private grantItemDrops(drops: EnemyItemDrop[] | undefined) {
    if (!drops) {
      return
    }

    for (const drop of drops) {
      if (!rollChance(drop.chance)) {
        continue
      }

      switch (drop.kind) {
        case 'material':
          if (this.materialRegistry.has(drop.itemId)) {
            const material = this.materialRegistry.get(drop.itemId)
            const amount = drop.amount ?? 1

            this.materialBag.add(material, amount)

            this.pendingNotifications.push({ kind: 'loot', message: `+${amount} ${material.name}` })
            this.addBattleRewardItem('material', drop.itemId, material.name, amount)
          }
          break

        case 'pill':
          if (this.pillRegistry.has(drop.itemId)) {
            const pill = this.pillRegistry.get(drop.itemId)
            const amount = drop.amount ?? 1

            this.pillBag.add(pill, amount)

            this.pendingNotifications.push({ kind: 'loot', message: `+${amount} ${pill.name}` })
            this.addBattleRewardItem('pill', drop.itemId, pill.name, amount)
          }
          break

        case 'equipment':
          if (this.equipmentRegistry.has(drop.itemId) && this.activePlayer) {
            const template = this.equipmentRegistry.get(drop.itemId)

            // Địa Giới ghép động (2026-08-15) — Zone chứa Stage đang
            // hoạt động lúc rớt đồ, xem ZoneRegistry.getZoneForStage()/
            // EquipmentNaming.ts. undefined nếu không có Stage đang
            // chạy (không nên xảy ra ở nhánh loot combat này, nhưng
            // graceful nếu có).
            const activeStageId = this.stageManager.get()?.stageId

            const zoneId = activeStageId ? this.zoneRegistry.getZoneForStage(activeStageId)?.id : undefined

            const instance = this.equipmentSystem.createInstance(
              template,
              this.activePlayer,
              this.affixRegistry,
              zoneId,
            )

            this.equipmentBag.add(instance)

            this.pendingNotifications.push({ kind: 'loot', message: `+1 ${template.name}` })
            this.addBattleRewardItem('equipment', drop.itemId, template.name, 1)
          }
          break

        // Phá Cảnh Tâm Pháp — rơi thẳng vào danh sách tâm pháp ĐÃ HỌC
        // (unlocked), giống cách nhặt equipment KHÔNG cần bước
        // "học" riêng như Đan/Phù/Trận. techniqueSystem.learn() tự
        // no-op nếu đã sở hữu (xem TechniqueSystem.ts) — chỉ toast
        // khi THỰC SỰ học mới (learn() trả true), tránh spam toast
        // trùng lặp mỗi lần rớt trúng công pháp đã sở hữu.
        case 'technique': {
          const template = this.techniqueTemplates.get(drop.itemId)

          if (template && this.techniqueSystem.learn(template)) {
            this.pendingNotifications.push({ kind: 'loot', message: `Học được: ${template.name}` })
            this.addBattleRewardItem('technique', drop.itemId, template.name, 1)
          }

          break
        }
      }
    }
  }

  // Gộp theo itemId+kind (nhiều wave cùng trận có thể rớt trùng loại)
  // thay vì đẩy 1 dòng riêng mỗi lần rớt — CombatVictoryPanel hiện
  // "+N tên vật phẩm" gọn, không lặp dòng.
  private addBattleRewardItem(kind: BattleRewardItemKind, itemId: string, name: string, amount: number) {
    const existing = this.battleRewardSummary.items.find(item => item.kind === kind && item.itemId === itemId)

    if (existing) {
      existing.amount += amount

      return
    }

    this.battleRewardSummary.items.push({ kind, itemId, name, amount })
  }

  /**
   * Vue layer (App.vue's tick()) gọi mỗi tick để rút toast phát sinh
   * TRONG GameManager kể từ lần gọi trước — trả về rồi xoá hàng đợi.
   */
  drainNotifications(): NotificationEvent[] {
    const drained = this.pendingNotifications

    this.pendingNotifications = []

    return drained
  }
}