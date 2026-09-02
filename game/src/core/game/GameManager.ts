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

import { investTinhHoa, computeBreakthroughGrade } from '../realm/BodyRefinementSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'
import { getAlchemySuccessBonusPercentPoints, getReactionKeepChance } from '../talent/TalentEffects'
import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'

import { BuffPool } from '../buff/BuffPool'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import type { BuffDefinition } from '../buff/BuffDefinition'

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
import { SkillSystem, HUY_KIEM_L3_CASTS } from '../skill/SkillSystem'
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
import { EquipmentBag, type AutoDissolveReward } from '../equipment/EquipmentBag'
import { EquipmentSystem } from '../equipment/EquipmentSystem'
import { DecomposeSystem } from '../production/DecomposeSystem'
import { MAX_SLOT_ENHANCE_LEVEL } from '../equipment/EnhanceCurve'
import type { RefineValueEntry } from '../equipment/EquipmentSystem'
import type { RolledAffix } from '../equipment/RolledAffix'
import { createDefaultEquipmentOperationCostCatalog } from '../equipment/EquipmentOperationCostCatalog'
import { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { EquipmentSlotState } from '../equipment/EquipmentSlotState'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import type { ItemQuality } from '../item/ItemQuality'
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

import { validateProfessionMaterialEntry } from '../profession/ProfessionValidators'
import {
  SPIRIT_STONE_CONVERSION_RATIO,
  getNextSpiritStoneMaterialId,
  getSpiritStoneMaterialIdForRealmTier,
} from '../material/SpiritStoneMaterial'
import {
  MATERIAL_TIER_CONVERSION_RATIO,
  getNextTierMaterialId,
} from '../material/MaterialTierConversionBalance'
import { getRealmTier } from '../realm/RealmTierMap'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import {
  TU_LINH_TRAN_BUFF_PERCENT,
  TU_LINH_TRAN_DURATION_MS,
  TU_LINH_TRAN_EFFECT_GROUP,
  getTuLinhTranCost,
} from '../economy/TuLinhTranBalance'
import { VendorSystem } from '../economy/VendorSystem'
import { EQUIPMENT_SLOTS } from '../equipment/EquipmentSlotState'

import { ProductionSystem } from '../production/ProductionSystem'
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
import { ITEM_QUALITY_ESSENCE_RANGE } from '../equipment/ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import type { Building } from '../building/Building'
import type { BuildingInstance } from '../building/BuildingInstance'

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
import { HiddenBeastSystem } from './HiddenBeastSystem'
import { TribulationDirector, type ActiveTribulationState } from '../tribulation/TribulationDirector'

import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import { QuestSystem } from '../quest/QuestSystem'
import type { Quest } from '../quest/Quest'
import type { QuestProgress } from '../quest/QuestProgress'


// Re-export giữ tương thích import cũ (useTribulation.ts import
// ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS từ GameManager).
export { TRIBULATION_COOLDOWN_SECONDS } from '../tribulation/TribulationDirector'
export type { ActiveTribulationState } from '../tribulation/TribulationDirector'


import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import type { BattleRewardSummary } from '../reward/BattleRewardSummary'

import { playerToCombatEntity, createPlayerRewardReceiver } from '../player/Player'
import { getKiemYPermanent } from '../player/KiemYSystem'
import { getWorkerCapacityForLevel } from '../production/WorkerCapacity'
import { HERO_LANE_INDEX } from '../battle/BattleLane'
import type { PlayerData, KiemTuRoute } from '../player/Player'
import type { MainStatKey } from '../stats/StatTypes'
import { getMainStatCap } from '../stats/StatCap'
import { MAIN_STAT_KEYS } from '../stats/StatTypes'
import { BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'
import { getTechniqueInsightTotalRequired, getTechniqueTier } from '../technique/TechniqueTier'
import { getSkillLoadoutSlotCount, KIEM_TRAN_SLOT_INDEX } from '../skill/SkillLoadoutSlots'
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

import type { GameSave } from '../../services/save/SaveSystem'

import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import { createBaseStats } from '../stats/StatBlock'

/**
 * GameManager lÃ  orchestrator (2026-08-24 refactor â€” tÃ¡ch business logic
 * tráº­n Ä‘áº¥u Ä‘ang diá»…n ra sang 3 service trong cÃ¹ng thÆ° má»¥c):
 *
 * 1. Khá»Ÿi táº¡o vÃ  giá»¯ instance cá»§a má»i Manager/System + wire dependency
 *    cho BattleLootSystem (loot/particle/toast/battle summary),
 *    StageWaveSystem (wave MÃ n + boss summon), TribulationSystem
 *    (runtime Äá»™ Kiáº¿p) â€” xem constructor().
 * 2. Äiá»u phá»‘i update(deltaSeconds) má»—i tick cho cÃ¡c system cÃ³ yáº¿u tá»‘
 *    thá»i gian (Buff, Skill, Battle) qua fixed-step catch-up.
 * 3. Tá»•ng há»£p modifier tá»« nhiá»u nguá»“n (buff/technique/skill).
 * 4. Giá»¯ public API á»•n Ä‘á»‹nh cho Vue layer/tests: cÃ¡c method cÃ²n láº¡i chá»§
 *    yáº¿u lÃ  facade delegate xuá»‘ng system tÆ°Æ¡ng á»©ng.
 *
 * ToÃ n bá»™ logic tháº­t (Ä‘iá»u kiá»‡n há»c skill, cÃ¡ch tÃ­nh reward...) náº±m
 * trong cÃ¡c System tÆ°Æ¡ng á»©ng.
 */

// Tráº¡ng thÃ¡i Tribulation (ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS)
// Ä‘Ã£ chuyá»ƒn sang TribulationSystem.ts â€” GameManager re-export á»Ÿ Ä‘áº§u file.

// Uncommitted audit followup plan, má»¥c "Fixed-step/catch-up cho combat"
// (2026-08-24) â€” App.vue Ä‘o deltaSeconds THáº¬T giá»¯a 2 láº§n tick() báº±ng
// GameClock (xem App.vue's tick()); khi tab bá»‹ trÃ¬nh duyá»‡t throttle
// (background/minimize) hoáº·c mÃ¡y vá»«a resume sau suspend, deltaSeconds
// cá»§a Má»˜T láº§n gá»i cÃ³ thá»ƒ lá»›n báº¥t thÆ°á»ng. battleSystem.update()/
// StageWaveSystem.update() chá»‰ kiá»ƒm tra timer <= 0 Má»˜T Láº¦N má»—i lá»i gá»i
// rá»“i reset vá» má»‘c má»›i (cadence skill, attackTimer, spawnCountdown) â€”
// KHÃ”NG cÃ³ vÃ²ng láº·p catch-up nhÆ° updateKimThe()/TribulationSystem.update(), nÃªn
// pháº§n ná»£ (timer Ã¢m sÃ¢u) bá»‹ vá»©t bá» tháº³ng: má»™t khoáº£ng deltaSeconds lá»›n
// chá»‰ táº¡o ra ÄÃšNG 1 Ä‘Ã²n Ä‘Ã¡nh/1 láº§n spawn thay vÃ¬ nhiá»u láº§n Ä‘Ãºng theo
// nhá»‹p tháº­t. Chia deltaSeconds thÃ nh cÃ¡c bÆ°á»›c cá»‘ Ä‘á»‹nh nhá» khi gá»i cÃ¡c
// hÃ m phá»¥ thuá»™c timer-Ä‘áº¿m-ngÆ°á»£c-rá»“i-reset nÃ y sá»­a Ä‘Ãºng gá»‘c váº¥n Ä‘á» mÃ 
// khÃ´ng cáº§n viáº¿t láº¡i vÃ²ng láº·p catch-up riÃªng cho tá»«ng timer.
const BATTLE_FIXED_STEP_SECONDS = 0.1

// Giá»›i háº¡n tá»•ng thá»i gian Ä‘Æ°á»£c "Ä‘uá»•i ká»‹p" cho má»—i láº§n update() â€” trÃ¡nh
// hÃ ng ngÃ n bÆ°á»›c Ä‘á»“ng bá»™ khoÃ¡ UI sau khi mÃ¡y ngá»§/tab bá»‹ treo ráº¥t lÃ¢u.
// Pháº§n deltaSeconds vÆ°á»£t ngÆ°á»¡ng nÃ y bá»‹ bá» qua cho riÃªng nhÃ¡nh combat/
// stage (coi nhÆ° tráº­n Ä‘áº¥u "táº¡m dá»«ng" trong khoáº£ng Ä‘Ã³) â€” cÃ¡c há»‡ thá»‘ng
// khÃ¡c (buff/cooldown/passive/formation á»Ÿ update() bÃªn dÆ°á»›i) váº«n nháº­n
// Äá»¦ deltaSeconds tháº­t vÃ¬ chÃºng vá»‘n Ä‘Ã£ an toÃ n vá»›i delta lá»›n.
const BATTLE_MAX_CATCHUP_SECONDS = 30

// PhÃ¡p Tu skill tree redesign (2026-08-21) â€” "Starter Skill KHÃ”NG náº±m
// bÃªn ngoÃ i skill tree, nÃ³ CHÃNH LÃ€ root node cá»§a skill tree hÃ nh Ä‘Ã³"
// (user spec). KhÃ´ng cÃ²n learnSkill() gá»i trá»±c tiáº¿p á»Ÿ Ä‘Ã¢y ná»¯a (Ä‘Ã³ lÃ 
// "auto-grant system riÃªng" mÃ  spec cáº¥m) â€” chooseCultivationPath() giá»
// mua node gá»‘c cá»§a Há»a (PHAP_TU_STARTER_NODE_ID, cost 0, xem
// data/progression/PhapTuNodes.ts's FIRE_LINH_NGO) qua ÄÃšNG con Ä‘Æ°á»ng
// purchaseNode() dÃ¹ng chung vá»›i 4 hÃ nh cÃ²n láº¡i (Thá»§y/Má»™c/Thá»•/Kim tá»‘n 2
// Skill Point, ngÆ°á»i chÆ¡i tá»± mua node gá»‘c cá»§a hÃ nh Ä‘Ã³). Chá»‰ Há»a Ä‘Æ°á»£c
// tá»± Ä‘á»™ng mua sáºµn (cost 0 = luÃ´n Ä‘á»§ Ä‘iá»ƒm); pháº§n "trang bá»‹ vÃ o slot 0"
// váº«n giá»¯ riÃªng (equip khÃ¡c há»c, xem SkillSystem.ts) vÃ¬ Node Tree
// khÃ´ng mÃ´ táº£ khÃ¡i niá»‡m loadout slot.
const PHAP_TU_STARTER_NODE_ID = 'hoa_linh_ngo'
const PHAP_TU_STARTER_SKILL_ID = 'hoa_cau_thuat'

export class GameManager {
  readonly eventBus = new EventBus()

  readonly combatSystem = new CombatSystem(this.eventBus)

  // ThiÃªn phÃº Báº¥t Tá»­ Thá»ƒ (talent-direction-choice-plan Â§6) â€” guard giá»¯ lÆ°á»£t
  // sá»‘ng sÃ³t battle-scoped; combatSystem.killIfDead() lÃ  Ä‘iá»ƒm tiÃªu thá»¥.
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
          ? `${skill.name} đạt cấp ${skill.level}`
          : `${skill.name} tăng ${levelsGained} cấp, đạt cấp ${skill.level}`,
    })
  })
  readonly skillEffectSystem = new SkillEffectSystem()
  readonly passiveSystem = new PassiveSystem(this.eventBus, this.skillManager, this.skillSystem)

  // PhÃ¡p Tu Redesign (magicpath) â€” Node Tree, háº¡ táº§ng CHUNG cho má»i
  // path, xem core/progression/.
  readonly nodeRegistry = new NodeRegistry()

  registerProgressionNodes(nodes: ProgressionNode[]) {
    for (const node of nodes) {
      if (!this.nodeRegistry.has(node.id)) {
        this.nodeRegistry.register(node)
      }
    }
  }

  // Khai bÃ¡o sau skillManager/skillSystem/skillEffectSystem/
  // buffRegistry vÃ¬ field class khá»Ÿi táº¡o theo thá»© tá»± khai bÃ¡o â€”
  // BattleSystem cáº§n cÃ¡c field nÃ y Ä‘Ã£ cÃ³ giÃ¡ trá»‹ (basic skill
  // thay auto-attack + auto-cast, xem BattleSystem.ts).
  readonly battleSystem = new BattleSystem(
    this.combatSystem,
    this.skillManager,
    this.skillSystem,
    this.skillEffectSystem,
    this.buffRegistry,
    this.eventBus,
    this.actionImpact,

    // Timed pill effects and socket modifiers remain live while the
    // restored 10Ã—16 battle recomputes effective stats each tick.
    () => (this.activePlayer ? this.getActiveRuntimeModifiers(this.activePlayer) : []),

    // Combat AI strategy (plan Â§7/Â§10) â€” PlayerData lÃ  authority; Ä‘á»c
    // LIVE Ä‘á»ƒ Ä‘á»•i strategy giá»¯a tráº­n cÃ³ hiá»‡u lá»±c ngay trong tick káº¿.
    () => this.activePlayer?.combatAiStrategy ?? DEFAULT_COMBAT_AI_STRATEGY,

    // ThiÃªn phÃº Pháº£n PhÃ¡c (talent-direction-choice-plan Â§6) â€” xÃ¡c suáº¥t giá»¯
    // ailment khi kÃ­ch Reaction, Ä‘á»c LIVE tá»« activePlayer.
    () => getReactionKeepChance(this.activePlayer?.selectedTalentIds ?? []),

    // Final review fix (Important #6) â€” nguá»“n sá»± tháº­t DUY NHáº¤T cho viá»‡c
    // kÃ­ch hoáº¡t channel Báº¡t Kiáº¿m, khá»›p Ä‘Ãºng Ä‘iá»u kiá»‡n channel UI Ä‘ang
    // Ä‘á»c (player.kiemTuRoute === 'bat_kiem').
    () => this.activePlayer?.kiemTuRoute,

    // Kiếm Ý vĩnh viễn (spec 2026-08-29-kiem-the-kiem-y mục 3) — closure
    // ĐÃ khai báo trong BattleSystem nhưng chưa từng được inject ở đây
    // (profile kiem-tu §4.7): thiếu nó → Kiếm Ý tạm đầu trận = 0, nerf
    // Bạt Kiếm mắc kẹt 0.6, on-hit không roll. Đọc LIVE từ bossKillCount.
    () => (this.activePlayer ? getKiemYPermanent(this.activePlayer.bossKillCount) : 0),

    // Hấp thụ Huy Kiếm (spec mục 3.4) — tổng cast của tram, đọc LIVE từ
    // skillManager (flat bonus floor(casts/10) vào Bạt Kiếm tick).
    () => this.skillManager.get('tram')?.totalExperience ?? 0,

    // On-hit Kiếm Trận (spec mục 4) — cấp node on-hit đã mua, lọc qua
    // nodeRegistry (chỉ node có effect.onHitEffect).
    () => this.getOnHitNodeLevelsSnapshot(),
  )

  /**
   * Snapshot cấp các node on-hit Kiếm Trận đã mua (đọc từ
   * PlayerData.nodeLevels qua registry — node là nguồn sự thật của
   * `effect.onHitEffect`). Trả `{}` khi chưa có player/chưa mua node.
   */
  getOnHitNodeLevelsSnapshot(): Record<string, number> {
    const levels: Record<string, number> = {}

    if (!this.activePlayer) {
      return levels
    }

    for (const [nodeId, level] of Object.entries(this.activePlayer.nodeLevels)) {
      if (level <= 0 || !this.nodeRegistry.has(nodeId)) {
        continue
      }

      const node = this.nodeRegistry.get(nodeId)

      if (node.effect.onHitEffect) {
        levels[nodeId] = level
      }
    }

    return levels
  }

  readonly techniqueManager = new TechniqueManager()
  readonly techniqueSystem = new TechniqueSystem(this.techniqueManager)

  readonly materialRegistry = new MaterialRegistry()
  readonly materialBag = new MaterialBag()

  readonly equipmentRegistry = new EquipmentRegistry()
  readonly equipmentBag = new EquipmentBag()
  readonly equipmentSystem = new EquipmentSystem(createDefaultEquipmentOperationCostCatalog())

  // Task 14 (rework P4) — Tab Phân Giải: khoáng → Luyện Khí Tinh Hoa.
  readonly decomposeSystem = new DecomposeSystem(this.materialBag, { autoWorkerCapacity: 0 })

  // Core Loop Foundation checklist (Phase 3, Má»¥c AFFIX) â€” thay tháº¿
  // hoÃ n toÃ n substatPool cÅ©.
  readonly affixRegistry = new AffixRegistry()

  // MASTER SPEC Má»¥c XVI (Phase 9) â€” CÆ°á»ng HÃ³a sá»‘ng á»Ÿ Ä‘Ã¢y (theo SLOT,
  // 6 slot cá»‘ Ä‘á»‹nh), tÃ¡ch khá»i EquipmentInstance.
  readonly equipmentSlotManager = new EquipmentSlotManager()

  readonly pillRegistry = new PillRegistry()
  readonly pillBag = new PillBag()
  readonly pillSystem = new PillSystem()

  // PhÃ¹/Tráº­n legacy (2026-08-25, plan Â§10.1.4) â€” registry giá»¯ láº¡i CHá»ˆ
  // Äá»ŒC nhÆ° tombstone Ä‘á»ƒ save cÅ© khÃ´ng crash vÃ¬ registry lookup; KHÃ”NG
  // cÃ²n bag, KHÃ”NG Ä‘Äƒng kÃ½ content má»›i dÃ¹ng Ä‘Æ°á»£c.
  readonly talismanRegistry = new TalismanRegistry()
  readonly formationRegistry = new FormationRegistry()

  readonly itemRegistry = new ItemRegistry(
    this.equipmentRegistry,
    this.pillRegistry,
    this.talismanRegistry,
    this.materialRegistry,
  )

  // =========================
  // Production (2026-08-25, resource-professions-rework plan Â§4) â€”
  // thay ExplorationSystem: ba nguá»“n LÃ¢m/QuÃ¡ng/Äá»™ng ThiÃªn cá»§a Thanh VÃ¢n
  // dÃ¹ng chung engine cycle snapshot + settle idempotent.
  // =========================
  readonly productionSystem = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })

  // Äan PhÃ²ng (plan Â§8) â€” job luyá»‡n Ä‘an vá»›i reserve atomic.
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

  // Session tráº­n Ä‘ang diá»…n ra (receiver nháº­n thÆ°á»Ÿng + PlayerData Ä‘á»ƒ roll
  // loot) Ä‘Ã£ chuyá»ƒn vÃ o BattleLootSystem â€” xem constructor().

  // Beta Phase 4 (Notification/UX) â€” hÃ ng Ä‘á»£i toast phÃ¡t sinh TRONG
  // core (loot tá»« BattleLootSystem, upgrade skill tá»« callback á»Ÿ trÃªn).
  private readonly notifications = new NotificationQueue()

  // =========================
  // RUNTIME SERVICES (2026-08-24 tÃ¡ch khá»i thÃ¢n class nÃ y)
  // =========================

  // Ba service dưới đây sở hữu business logic trận đấu đang diễn ra:
  // - BattleLootSystem: loot/particle/toast/battle summary khi quái chết.
  // - StageWaveSystem: vòng đời wave của Màn + boss summon.
  // - TribulationDirector: runtime chương kiếp mới (tâm ma + tank lôi,
  //   spec dot-pha-loi-kiep §5) + cooldown.
  // Khởi tạo trong constructor (KHÔNG phải field initializer) vì cần
  // tham chiếu tới các field khai báo SAU chúng ở trên (bags/registries/
  // zoneRegistry/template registries) — field initializer chạy theo thứ
  // tự khai báo nên không thấy được; ctor body chạy sau cùng, an toàn.

  private readonly battleLoot: BattleLootSystem
  private readonly stageWaves: StageWaveSystem
  private readonly tribulationDirector: TribulationDirector

  // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — cửa sổ 1000 kill Luyện Khí.
  readonly hiddenBeastSystem: HiddenBeastSystem

  constructor() {
    // Kiáº¿m Tu (2026-08-28) â€” mirror player.skillCastCounts/skillLevels
    // má»—i láº§n cast, phá»¥c vá»¥ NodeSystem prerequisite `skillCastCount`
    // (NodeSystem chá»‰ nháº­n PlayerData, khÃ´ng cÃ³ SkillManager). Ghi vÃ o
    // activePlayer (Ä‘Äƒng kÃ½ qua setActivePlayer(), xem field bÃªn dÆ°á»›i)
    // â€” no-op an toÃ n náº¿u chÆ°a cÃ³ player active (vd unit test dá»±ng
    // GameManager tráº§n).
    this.skillSystem.setCastCountSink((skillId, totalExperience, level) => {
      if (!this.activePlayer) return

      this.activePlayer.skillCastCounts ??= {}
      this.activePlayer.skillCastCounts[skillId] = totalExperience

      this.activePlayer.skillLevels ??= {}
      this.activePlayer.skillLevels[skillId] = level
    })

    // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — tra template qua registry
    // chung (registerEnemyTemplates đã đăng ký Huyết Mông qua ENEMIES).
    this.hiddenBeastSystem = new HiddenBeastSystem({
      getEnemyTemplate: (id) => this.enemyTemplates.get(id),
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
      battleSystem: this.battleSystem,
      enemySystem: this.enemySystem,
      stageManager: this.stageManager,
      stageSystem: this.stageSystem,
      stageTemplates: this.stageTemplates,
      enemyTemplates: this.enemyTemplates,
      isStageUnlocked: (stageId, player) => this.isStageUnlocked(stageId, player),
      launchBattle: (player, playerStats, enemy) =>
        this.startBattleWithPlayer(player, playerStats, enemy),
      hiddenBeast: this.hiddenBeastSystem,
    })

    this.tribulationDirector = new TribulationDirector({
      eventBus: this.eventBus,
    })
  }

  /**
   * Skill runtime stats + node-derived skillModifiers (plan Â§6.8) â€”
   * thay Ä‘Æ°á»ng mutate Skill instance lÃºc purchase: cá»™ng flat/perLevel
   * suy ra tá»« (registry, nodeLevels) lÃªn trÃªn tá»•ng há»£p cá»§a SkillSystem.
   * Public cho UI/test; combat snapshot Ä‘i qua cÃ¹ng Ä‘Æ°á»ng nÃ y.
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
  // Náº¡p dá»¯ liá»‡u tÄ©nh (tá»« /data) vÃ o cÃ¡c Manager. Gá»i 1 láº§n lÃºc
  // khá»Ÿi táº¡o game. TÃ¡ch riÃªng khá»i constructor Ä‘á»ƒ cÃ³ thá»ƒ gá»i láº¡i
  // trong test hoáº·c khi cáº§n náº¡p thÃªm data theo DLC/patch sau nÃ y.

  registerMaterials(materials: Material[]) {
    // Boot validator (plan Â§4.1/Â§10 Phase 1): lá»—i authoring dá»¯ liá»‡u nghá»
    // fail NGAY khi Ä‘Äƒng kÃ½ â€” khÃ´ng Ã¢m tháº§m táº¡o kinh táº¿ há»ng. Chá»‰ validate
    // material CÃ“ meta nghá» (legacy material khÃ´ng Ä‘á»¥ng); kiá»ƒm tra
    // PER-ENTRY (id convention + realm scope) â€” completeness toÃ n catalog
    // (Ä‘á»§ 3 rarity/cell) enforce á»Ÿ ProfessionDataIntegrity.test trÃªn
    // TOÃ€N Bá»˜ máº£ng materials (registerMaterials cÃ³ thá»ƒ Ä‘Æ°á»£c gá»i tá»«ng
    // pháº§n trong test).
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

  registerBuffs(buffs: BuffDefinition[]) {
    for (const buff of buffs) {
      if (!this.buffRegistry.has(buff.id)) {
        this.buffRegistry.register(buff)
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

  /** ÄÄƒng kÃ½ Ä‘an phÆ°Æ¡ng (plan Â§8) â€” validate mapping tháº£o duy nháº¥t. */
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
    // Tombstone-only (plan Â§10.1.4).
    for (const formation of formations) {
      if (!this.formationRegistry.has(formation.id)) {
        this.formationRegistry.register(formation)
      }
    }
  }

  registerTalismans(talismans: Talisman[]) {
    // Tombstone-only (plan Â§10.1.4) â€” Ä‘Äƒng kÃ½ Ä‘á»ƒ save cÅ© load khÃ´ng
    // crash, KHÃ”NG táº¡o nguá»“n má»›i.
    for (const talisman of talismans) {
      if (!this.talismanRegistry.has(talisman.id)) {
        this.talismanRegistry.register(talisman)
      }
    }
  }

  // Skill/Technique khÃ´ng "register" sáºµn cÃ³ toÃ n bá»™ danh sÃ¡ch gá»‘c
  // vÃ o manager â€” chÃºng chá»‰ Ä‘Æ°á»£c add khi ngÆ°á»i chÆ¡i thá»±c sá»± há»c
  // (learn), Ä‘Ãºng nhÆ° SkillSystem.learn()/TechniqueSystem.learn()
  // Ä‘Ã£ thiáº¿t káº¿. GameManager chá»‰ cung cáº¥p nÆ¡i tra cá»©u template.
  private skillTemplates = new TemplateRegistry<Skill>()
  private techniqueTemplates = new TemplateRegistry<Technique>()

  // Enemy template tra theo id (dÃ¹ng bá»Ÿi StageSystem khi chá»n quÃ¡i
  // káº¿ tiáº¿p Ä‘á»ƒ spawn) â€” cÃ¹ng pattern skillTemplates/techniqueTemplates,
  // KHÃC EnemyManager (chá»‰ chá»©a instance Ä‘Ã£ spawn, cÃ³ id riÃªng tá»«ng
  // con â€” xem EnemySystem.spawn()).
  private enemyTemplates = new TemplateRegistry<Enemy>()

  // Stage template tra theo id â€” cÃ¹ng pattern enemyTemplates.
  private stageTemplates = new TemplateRegistry<Stage>()

  // ThÃ¡m Hiá»ƒm rework â€” Äá»‹a Giá»›i (nhÃ³m nhiá»u Stage/MÃ n), xem
  // core/stage/Zone.ts. Registry tháº­t (khÃ´ng pháº£i Map tráº§n nhÆ°
  // stageTemplates) vÃ¬ StageSelectPanel.vue cáº§n getAll()/has() trá»±c
  // tiáº¿p, khÃ´ng chá»‰ tra theo id Ä‘Æ¡n láº».
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
   * Tá»± Äá»™ng ThÃ¡m Hiá»ƒm (mode 'auto', xem stores/ui.ts) â€” MÃ n káº¿ tiáº¿p
   * trong CÃ™NG Äá»‹a Giá»›i vá»›i `currentStageId`, theo Ä‘Ãºng thá»© tá»± khai
   * trong `Zone.stageIds`. Tráº£ vá» null náº¿u Ä‘Ã£ á»Ÿ MÃ n cuá»‘i hoáº·c
   * currentStageId khÃ´ng thuá»™c zone nÃ y â€” caller (App.vue's
   * fightStage()) tá»± fallback láº·p láº¡i MÃ n hiá»‡n táº¡i khi null (graceful,
   * khÃ´ng cáº§n biáº¿t trÆ°á»›c zone cÃ³ bao nhiÃªu MÃ n).
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
      // Stage Ä‘á»™c láº­p (Äá»™ Kiáº¿p/test/debug) khÃ´ng thuá»™c tuyáº¿n thÃ¡m hiá»ƒm.
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
   * PhÃ¡p Tu Redesign (magicpath) â€” mua 1 ProgressionNode (LÄ¨NH NGá»˜,
   * 0â†’1). Gá»i `purchaseNode()` thuáº§n (core/progression/NodeSystem.ts)
   * trÆ°á»›c â€” hÃ m Ä‘Ã³ tá»± xá»­ lÃ½ má»i thá»© khÃ´ng cáº§n registry. Chá»‰ cÃ²n
   * `unlocksSkillIds` cáº§n learnSkill() (cáº§n skillTemplates, GameManager
   * má»›i cÃ³). KHÃ”NG tá»± equip skill vá»«a unlock.
   *
   * Â§6.8 â€” KHÃ”NG cÃ²n mutate Skill instance / push player.modifiers lÃºc
   * mua: má»i hiá»‡u lá»±c suy ra tá»« (registry, nodeLevels) qua aggregator
   * (getAggregatedModifiers + buildSkillRuntimeStats), recompute luÃ´n
   * cho cÃ¹ng káº¿t quáº£ xÃ¡c Ä‘á»‹nh.
   */
  purchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.nodeRegistry.has(nodeId)) {
      return false
    }

    const node = this.nodeRegistry.get(nodeId)

    if (!purchaseNodeSystem(player, node)) {
      return false
    }

    // Effect má»Ÿ khoÃ¡ skill chá»‰ cháº¡y á»Ÿ chuyá»ƒn tiáº¿p 0 â†’ 1 â€”
    // purchaseNodeSystem chá»‰ tráº£ true Ä‘Ãºng á»Ÿ chuyá»ƒn tiáº¿p nÃ y.
    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId)

      // Kiếm Thế / Kiếm Ý (spec 2026-08-29 mục 5.1) — kiếm trận tiến
      // hóa: mỗi route ĐÚNG 1 active skill ở slot 0, keystone mới tự
      // THAY THẾ trận cũ (equipToSlot tự dời occupant cũ). KHÔNG còn
      // slot riêng KIEM_TRAN_SLOT_INDEX.
      if (skillId.startsWith('kiem_tran_')) {
        this.skillSystem.equipToSlot(skillId, 0)
      }
    }

    return true
  }

  /** Cáº¥p reward Ä‘áº¡i cáº£nh giá»›i theo cultivation path tá»« data kit. */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId, {
      getEquippedTechnique: () => this.techniqueManager.getEquipped(),
      getTechnique: techniqueId => this.techniqueManager.get(techniqueId),
      learnTechnique: techniqueId => this.learnTechnique(techniqueId),
      equipTechnique: techniqueId => this.equipTechnique(techniqueId),
    })
  }

  /**
   * NÃ¢ng node Ä‘Ã£ lÄ©nh ngá»™ lÃªn +1 cáº¥p báº±ng Cáº£m Ngá»™ (Â§6.2) â€” cost theo
   * data node; khÃ´ng vÆ°á»£t maxLevel; tháº¥t báº¡i khÃ´ng mutate gÃ¬.
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

  /** Cost Cáº£m Ngá»™ cá»§a láº§n mua/nÃ¢ng Káº¾ TIáº¾P â€” undefined khi Ä‘Ã£ max. */
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
   * Reset development má»™t nhÃ¡nh (Â§6.10) â€” hoÃ n Ä‘Ãºng tá»•ng Cáº£m Ngá»™ Ä‘Ã£
   * tiÃªu (suy tá»« level/cost data), cascade gá»¡ node con má»“ cÃ´i; modifier
   * tá»± cáº­p nháº­t qua aggregator (khÃ´ng trá»« ngÆ°á»£c modifier cÅ©).
   */
  devResetBranch(branchTag: string, player: PlayerData): number {
    return devResetBranchSystem(player, this.nodeRegistry, branchTag)
  }

  /**
   * skill-insight-and-auto-combat-hud-plan.md má»¥c 5 â€” nÃ¢ng cáº¥p skill
   * báº±ng Cáº£m ngá»™ Ká»¹ nÄƒng, thuáº§n pass-through xuá»‘ng SkillSystem (Ä‘Ã£ cÃ³
   * skillManager qua constructor, khÃ´ng cáº§n gÃ¬ thÃªm tá»« GameManager).
   */
  upgradeSkill(skillId: string, player: PlayerData): boolean {
    return this.skillSystem.upgradeSkill(skillId, player)
  }

  getSkillUpgradeInsightCost(skillId: string): number | undefined {
    return this.skillSystem.getSkillUpgradeInsightCost(skillId)
  }

  /**
   * PLAN HOÃ€N CHá»ˆNH má»¥c 2 â€” tiÃªu 1 attributePoint vÃ o ÄÃšNG 1 Main Stat.
   * No-op (tráº£ false) náº¿u háº¿t Ä‘iá»ƒm hoáº·c stat Ä‘Ã£ cháº¡m tráº§n Ä‘áº¡i cáº£nh
   * giá»›i hiá»‡n táº¡i (getMainStatCap()) â€” tráº§n tÃ­nh riÃªng tá»«ng stat,
   * KHÃ”NG cÃ³ tráº§n tá»•ng cá»§a cáº£ 5 (Ä‘Ãºng "NguyÃªn táº¯c" má»¥c 2 cá»§a doc).
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
   * TÃ¢m PhÃ¡p Chiáº¿n Äáº¥u cÃ³ thá»ƒ mang `innateSkillId` (ná»™i táº¡i chiáº¿n Ä‘áº¥u
   * Ä‘áº·c trÆ°ng) â€” tá»± há»c + equip skill passive Ä‘Ã³ ngay khi tÃ¢m phÃ¡p
   * Ä‘Æ°á»£c trang bá»‹, pattern Y Há»†T syncRealmPassive() (idempotent qua
   * skillManager.has(), un-equip technique sau Ä‘Ã³ KHÃ”NG tá»± gá»¡ skill â€”
   * giá»¯ tinh tháº§n "há»c rá»“i thÃ¬ giá»¯" toÃ n há»‡ thá»‘ng).
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

        // innateSkillId luÃ´n lÃ  passive (xem Technique.ts) â€” khÃ´ng
        // thuá»™c Skill Loadout, dÃ¹ng equipWithoutSlot() nhÆ° má»i passive
        // khÃ¡c (syncRealmPassive()).
        this.skillSystem.equipWithoutSlot(technique.innateSkillId)
      }
    }

    return true
  }

  unequipTechnique(techniqueId: string): boolean {
    return this.techniqueSystem.unequip(techniqueId)
  }

  /**
   * PhÃ¡p Tu profession-tier ladder (2026-08-14, há»£p nháº¥t TÃ¢m PhÃ¡p
   * 2026-08-15) â€” "chá»n nghá» nghiá»‡p", Má»˜T Láº¦N DUY NHáº¤T, VÄ¨NH VIá»„N (xem
   * PlayerData.cultivationPath) â€” tá»± cáº¥p ÄÃšNG bá»™ kit cá»‘ Ä‘á»‹nh cá»§a tier
   * Ä‘Ã³: 1 TÃ¢m PhÃ¡p há»£p nháº¥t (GHI ÄÃˆ tÃ¢m phÃ¡p Ä‘ang trang bá»‹, ká»ƒ cáº£ tÃ¢m
   * phÃ¡p khá»Ÿi Ä‘áº§u) + 3 skill cá»‘ Ä‘á»‹nh (basic/special/ultimate, GHI ÄÃˆ
   * báº¥t ká»³ skill nÃ o Ä‘ang chiáº¿m 3 slot Ä‘Ã³). KHÃ”NG pháº£i há»‡ thá»‘ng build
   * tá»± do â€” tÃ¡i dÃ¹ng nguyÃªn váº¹n learnTechnique()/equipTechnique()/
   * learnSkill()/equipSkill() Ä‘Ã£ cÃ³.
   *
   * Nghi Lá»… Nháº­p MÃ´n (2026-08-16) â€” chá»n path CHÃNH LÃ€ nghi lá»… Ä‘á»™t phÃ¡
   * PhÃ m NhÃ¢n -> Luyá»‡n KhÃ­ (Ä‘Ãºng "Ä‘á»™t phÃ¡ lÃªn cáº£nh giá»›i má»›i luÃ´n cÃ³
   * nghi lá»…" â€” TrÃºc CÆ¡ cÃ³ Äá»™ Kiáº¿p riÃªng, PhÃ m NhÃ¢n->Luyá»‡n KhÃ­ dÃ¹ng
   * chÃ­nh hÃ nh Ä‘á»™ng chá»n nghá» nÃ y thay vÃ¬ 1 nÃºt Äá»™t PhÃ¡ thÆ°á»ng, xem
   * CultivationSystem.breakthrough()'s guard cháº·n realmId === 'mortal').
   * Náº¿u player Ä‘ang á»Ÿ PhÃ m NhÃ¢n lÃºc chá»n, atomically chuyá»ƒn luÃ´n sang
   * qi_refining táº§ng 1 â€” 3 hÃ m gá»i sau Ä‘Ã³ GIá»NG Há»†T useBreakthrough.ts/
   * useTribulation.ts gá»i sau má»i láº§n Ä‘á»™t phÃ¡ Ä‘áº¡i cáº£nh giá»›i.
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

    // Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 1) — route
    // chốt VĨNH VIỄN đúng lúc chọn path: Huy Kiếm (tram) đã đạt Lv3
    // (10.000 lần trảm) → Bạt Kiếm; chưa → Kiếm Trận. KHÔNG còn API
    // đổi route (setKiemTuRoute đã dỡ) — branch node còn lại bị ẩn ở
    // UI (SkillPathPanel hiển thị đúng 1 branch theo route).
    // kit.skillIds của Kiếm Tu giờ KHÔNG dùng nữa (mỗi route 1 skill
    // duy nhất, gán trong nhánh này) — tuple 3-skill cũ đã dỡ khỏi
    // CultivationPathKit.
    if (pathId === 'kiem_tu') {
      const tramCasts = player.skillCastCounts?.['tram'] ?? 0
      const route: KiemTuRoute = tramCasts >= HUY_KIEM_L3_CASTS ? 'bat_kiem' : 'kiem_tran'

      player.kiemTuRoute = route

      // Mỗi route ĐÚNG 1 active skill duy nhất (spec mục 5) — tháo bộ
      // skill kit cũ + tram khỏi loadout (KHÔNG unlearn: Phàm Nhân save
      // khác vẫn dùng tram được; Kiếm Tu đã chốt route thì tram bị khóa
      // re-equip qua guard ở SkillSystem — xem guard tram phía dưới).
      this.skillSystem.unequip('tram')
      for (const skillId of ['ngu_kiem_thuat', 'kiem_khai_thien_mon', 'van_kiem_trieu_tong']) {
        this.skillSystem.unequip(skillId)
      }
    } else if (kit.skillIds) {
      kit.skillIds.forEach((skillId, index) => {
        this.learnSkill(skillId)
        this.skillSystem.equipToSlot(skillId, index)
      })
    } else {
      // Skill tree redesign (2026-08-21) â€” Há»a Cáº§u Thuáº­t lÃ  ROOT NODE
      // cá»§a Há»a skill tree (khÃ´ng pháº£i 1 skill há»c riÃªng bÃªn ngoÃ i cÃ¢y),
      // xem data/progression/PhapTuNodes.ts's FIRE_LINH_NGO â€” cost 0 nÃªn
      // luÃ´n mua Ä‘Æ°á»£c ngay, purchaseNode() tá»± lo learnSkill() qua
      // unlocksSkillIds. Sau Ä‘Ã³ trang bá»‹ NGAY vÃ o slot 0, thay vÃ¬ báº¯t
      // ngÆ°á»i chÆ¡i tá»± má»Ÿ Node Tree + Radial Skill Selector trÆ°á»›c khi
      // Ä‘Ã¡nh Ä‘Æ°á»£c tráº­n nÃ o. equipToSlot() tá»± dá»i skill Ä‘ang chiáº¿m slot 0
      // (Tráº£m cá»§a PhÃ m NhÃ¢n) â€” execution policy rework (plan Â§8.6) khÃ´ng
      // cÃ²n mutual-exclusion Ä‘Ã²n cÆ¡ báº£n riÃªng. VÃ¬ luÃ´n cÃ³ skill ngay
      // sau bÆ°á»›c nÃ y, gate blockIfNoBasicAttack() á»Ÿ useBattleActions.ts/
      // useTribulation.ts Ä‘Ã£ Gá»  theo (khÃ´ng cÃ²n tÃ¬nh huá»‘ng "chÆ°a trang bá»‹
      // gÃ¬" ná»¯a). Thá»§y/Má»™c/Thá»•/Kim KHÃ”NG tá»± mua â€” root node cá»§a 4 hÃ nh
      // Ä‘Ã³ tá»‘n 2 Skill Point, ngÆ°á»i chÆ¡i tá»± mua qua Node Tree UI.
      this.purchaseNode(PHAP_TU_STARTER_NODE_ID, player)

      this.skillSystem.equipToSlot(PHAP_TU_STARTER_SKILL_ID, 0)
    }

    if (player.realmId === 'mortal') {
      // Realm Passive & Pressure System (2026-08-20) â€” chá»‘t Báº­c Nháº­p
      // Äáº¡o TRÆ¯á»šC khi grant, Ä‘á»ƒ Nháº­p Äáº¡o (RealmPassives.ts) Ä‘á»c Ä‘Ãºng
      // giÃ¡ trá»‹ cuá»‘i cÃ¹ng cá»§a Luyá»‡n Thá»ƒ táº¡i thá»i Ä‘iá»ƒm Lá»… Nháº­p MÃ´n.
      player.breakthroughGrade = computeBreakthroughGrade(player)

      // Spec dot-pha-loi-kiep §4.2 — snapshot "hoàn hảo Phàm Nhân"
      // (5/5 main stat đạt cap mortal + Luyện Th thể 6/6) chốt đúng
      // lúc bấm Quán Khí, KHÔNG hồi cứu sau khi vào Luyện Khí. Là 1
      // điều kiện Đại Đạo Trúc Cơ.
      player.mortalPerfectionAchieved =
        player.bodyRefinementCompletedTiers >= BODY_REFINEMENT_TIERS.length &&
        MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= getMainStatCap('mortal'))

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      this.syncRealmPassive(player)
      this.syncRealmStatPassive(player)
    }

    // Kiếm Thế / Kiếm Ý (spec mục 1/5) — grant skill route SAU realm
    // advance: root Lưỡng Nghi có realm prereq 'qi_refining', phải đợi
    // Lễ Nhập Môn đổi realm xong mới purchaseNode được. Mỗi route ĐÚNG
    // 1 active skill ở slot 0 (đơn kiếm/bạt kiếm thức hoặc đa kiếm/
    // lưỡng nghi tiến hóa).
    if (pathId === 'kiem_tu' && player.kiemTuRoute === 'bat_kiem') {
      this.learnSkill('bat_kiem_thuat')
      this.skillSystem.equipToSlot('bat_kiem_thuat', 0)
    } else if (pathId === 'kiem_tu') {
      this.purchaseNode('kiem_tran_luong_nghi', player)
    }

    return true
  }

  /**
   * Báº£n Má»‡nh PhÃ¡p Báº£o (doc Â§7.1) â€” chá»n/Ä‘á»•i hÆ°á»›ng CÃ´ng/Thá»§/Khá»‘ng. Äá»•i
   * Ä‘Æ°á»£c NHIá»€U Láº¦N ngoÃ i combat (khÃ¡c chooseCultivationPath() á»Ÿ trÃªn â€”
   * Ä‘Ã³ lÃ  lá»±a chá»n vÄ©nh viá»…n, Ä‘Ã¢y lÃ  "Ä‘á»•i miá»…n phÃ­ ngoÃ i combat Ä‘á»ƒ
   * test"). Giá»¯ nguyÃªn EXP/táº§ng/pháº©m, chá»‰ Ã¡p dá»¥ng tá»« tráº­n káº¿ (runtime
   * artifact snapshot path lÃºc Battle báº¯t Ä‘áº§u, khÃ´ng Ä‘á»c láº¡i giá»¯a tráº­n).
   * KHÃ”NG dÃ¹ng window.confirm â€” khÃ¡c QuanKhiPanel.vue (lá»±a chá»n Ä‘Ã³
   * khÃ´ng thá»ƒ Ä‘á»•i láº¡i, Ä‘Ã¢y thÃ¬ cÃ³).
   */
  setArtifactPath(player: PlayerData, path: ArtifactPath): boolean {
    if (!player.artifact) {
      return false
    }

    const battle = this.getBattle()

    if (battle && (battle.state === 'countdown' || battle.state === 'fighting')) {
      return false
    }

    player.artifact.selectedPath = path

    return true
  }

  /**
   * Kiếm Tu tự lực (2026-08-28) từng có setKiemTuRoute() đổi route
   * ngoài combat — ĐÃ DỞ (spec 2026-08-29-kiem-the-kiem-y mục 1): route
   * giờ chốt VĨNH VIỄN trong chooseCultivationPath('kiem_tu') theo
   * tram Lv3, không còn thao tác đổi sau này.
   */


  /**
   * Báº£n Má»‡nh PhÃ¡p Báº£o (doc Â§5.3) â€” nÃ¢ng pháº©m báº±ng ÄoÃ¡n Báº£o Tháº¡ch, CHá»ˆ
   * ngoÃ i combat (transaction tháº­t náº±m á»Ÿ tryUpgradeArtifactGrade() core
   * thuáº§n â€” enforce guard combat NGAY Táº I ÄÃ‚Y, khÃ´ng chá»‰ á»Ÿ UI).
   */
  tryUpgradeArtifactGrade(player: PlayerData): boolean {
    if (!player.artifact) {
      return false
    }

    const battle = this.getBattle()

    if (battle && (battle.state === 'countdown' || battle.state === 'fighting')) {
      return false
    }

    return tryUpgradeArtifactGrade(player.artifact, this.materialBag)
  }

  /**
   * PLAN HOÃ€N CHá»ˆNH má»¥c 8/12 â€” "Set Skill vÃ o Loadout" (Táº§ng 4), tÃ¡ch
   * biá»‡t HOÃ€N TOÃ€N khá»i learnSkill()/purchaseNode() (Táº§ng 3, "há»c").
   * skillId === null thÃ¬ Dá»ŒN slot Ä‘Ã³ (unequip skill Ä‘ang chiáº¿m, náº¿u
   * cÃ³). Validate slotIndex theo tiáº¿n trÃ¬nh cáº£nh giá»›i á»Ÿ ÄÃ‚Y (khÃ´ng
   * pháº£i SkillSystem â€” domain thuáº§n khÃ´ng biáº¿t realm).
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
   * Combat AI strategy (plan Â§10) â€” PlayerData lÃ  nguá»“n sá»± tháº­t duy nháº¥t;
   * UI khÃ´ng tá»± giá»¯ state. Validate qua isCombatAiStrategy() dÃ¹ng chung,
   * tráº£ false náº¿u giÃ¡ trá»‹ sai. LÆ°u tá»± kÃ­ch hoáº¡t qua save scheduling hiá»‡n
   * cÃ³ (autosave/visibilitychange) sau khi UI bumpState().
   */
  setCombatAiStrategy(player: PlayerData, strategy: CombatAiStrategy): boolean {
    if (!isCombatAiStrategy(strategy)) {
      return false
    }

    player.combatAiStrategy = strategy

    return true
  }

  // Core Loop Foundation checklist (Má»¥c SKILL) â€” "behavior-changing
  // node".
  selectSkillSpecialization(skillId: string, specializationId: string): boolean {
    return this.skillSystem.selectSpecialization(skillId, specializationId)
  }

  // =========================
  // MODIFIER AGGREGATION
  // =========================

  /**
   * Modifier tá»•ng há»£p tá»« Buff + Technique Ä‘ang trang bá»‹ + Skill
   * passive Ä‘ang equipped. Stack cá»§a passiveModifiers Ä‘Æ°á»£c
   * PassiveSystem tÃ­ch trá»±c tiáº¿p lÃªn object Skill (xem
   * PassiveSystem.ts) nÃªn chá»‰ cáº§n Ä‘á»c tháº³ng tá»« skillManager, khÃ´ng
   * cáº§n má»™t bÆ°á»›c "gá»™p" riÃªng nhÆ° trÆ°á»›c Ä‘Ã¢y comment cÅ© nháº¯c tá»›i.
   *
   * ÄÃ¢y lÃ  Ä‘iá»ƒm duy nháº¥t trong toÃ n bá»™ game tá»•ng há»£p modifier
   * theo thá»i gian thá»±c. player.ts (store) chá»‰ cáº§n gá»i hÃ m nÃ y
   * má»—i tick thay vÃ¬ tá»± Ä‘i gá»™p tá»« buffSystem/techniqueSystem/skillManager.
   */
  /**
   * `player` optional (máº·c Ä‘á»‹nh bá» qua tier tÃ¢m phÃ¡p) â€” nhiá»u call site
   * cÅ© (test files, vÃ i panel refresh phá»¥) gá»i hÃ m nÃ y KHÃ”NG cÃ³ sáºµn
   * PlayerData tiá»‡n tay; chá»¯ kÃ½ cÅ© váº«n há»£p lá»‡ nguyÃªn váº¹n. Call site
   * "tháº­t" má»—i tick (App.vue) LUÃ”N truyá»n player Ä‘á»ƒ tier tÃ¢m phÃ¡p cÃ³
   * hiá»‡u lá»±c â€” xem getTechniqueTierModifiers().
   */
  getAggregatedModifiers(player?: PlayerData): StatModifier[] {
    // STATIC-ONLY (2026-08-24, plan Â§5.4): timed effect + socket
    // PhÃ¹/Tráº­n lÃ  modifier Sá»NG â€” KHÃ”NG náº±m á»Ÿ Ä‘Ã¢y Ä‘á»ƒ finalStats caller
    // truyá»n vÃ o battle lÃ  snapshot tÄ©nh sáº¡ch (khÃ´ng double-apply);
    // combat recompute nháº­n runtime qua provider má»—i tick, menu hiá»ƒn thá»‹
    // qua store getter cá»™ng getActiveRuntimeModifiers().
    return [
      ...this.buffSystem.getActiveModifiers(),
      // Core Loop Foundation checklist (Má»¥c SKILL) - qua
      // getScaledPassiveModifiers() thay vÃ¬ Ä‘á»c tháº³ng
      // skill.passiveModifiers, Ä‘á»ƒ Ã¡p Specialization + level scaling.
      ...this.skillSystem.getScaledPassiveModifiers(),
      ...(player ? this.getTechniqueTierModifiers(player) : []),
      ...(player ? getCultivationPathStatModifiers(player) : []),
      // Node level (plan Â§6.8) â€” modifier node suy ra tá»« (registry,
      // nodeLevels), scale theo level hiá»‡n hÃ nh; KHÃ”NG náº±m trong
      // player.modifiers ná»¯a.
      ...(player ? aggregateNodeStatModifiers(this.nodeRegistry, player) : []),
      // Combat-gate-teleport-autocast plan Â§9 â€” combatModifiers cá»§a tÃ¢m
      // phÃ¡p ÄANG trang bá»‹ (+2 attackRange Äáº¡i NgÅ© HÃ nh ChÃ¢n Quyáº¿t):
      // cá»‘ Ä‘á»‹nh, khÃ´ng theo tier, chá»‰ khi equipped. DUY NHáº¤T Ä‘Æ°á»ng tá»•ng
      // há»£p Ä‘á»ƒ trÃ¡nh cá»™ng hai láº§n.
      ...this.getTechniqueCombatModifiers(),
    ]
  }

  /** Modifier combat cá»‘ Ä‘á»‹nh cá»§a tÃ¢m phÃ¡p Ä‘ang trang bá»‹ (plan Â§9). */
  private getTechniqueCombatModifiers(): StatModifier[] {
    const technique = this.techniqueManager.getEquipped()

    if (!technique?.equipped || !technique.combatModifiers) {
      return []
    }

    return [...technique.combatModifiers]
  }

  /**
   * PLAN HOÃ€N CHá»ˆNH má»¥c 5 rework (2026-08-20) â€” hiá»‡u á»©ng chá»‰ sá»‘ cá»§a tÃ¢m
   * phÃ¡p ÄANG trang bá»‹, theo ÄÃšNG tier hiá»‡n táº¡i (getTechniqueTier(),
   * giá» tÃ­nh tá»« techniqueExperience â€” thanh kinh nghiá»‡m riÃªng cá»§a TÃ¢m
   * PhÃ¡p, xem TechniqueTier.ts). manaRegenPercent cá»‘ Ã½ map vÃ o percent
   * Cá»¦A stat manaRegenPerSecond (Increased chuáº©n, xem StatCalculator.ts's
   * runPipeline) thay vÃ¬ %maxMp â€” %maxMp sáº½ táº¡o phá»¥ thuá»™c vÃ²ng (maxMp
   * chÆ°a tÃ­nh xong ngay táº¡i bÆ°á»›c gá»™p modifier nÃ y).
   */
  // =========================
  // RUNTIME MODIFIER AUTHORITY (2026-08-24, resource-professions-rework
  // Phase 4/6 â€” plan Â§5.4/Â§7.2): modifier Sá»NG theo thá»i gian (timed
  // effect) + modifier socket trÃªn slot (PhÃ¹/Tráº­n). Má»˜T authority duy
  // nháº¥t á»Ÿ Ä‘Ã¢y â€” menu (getAggregatedModifiers) vÃ  combat recompute
  // (BattleSystem qua provider) cÃ¹ng Ä‘á»c, khÃ´ng hai báº£n sao lá»‡ch nhau.
  // KHÃ”NG bao giá» vÃ o CombatEntity.baseStats snapshot.
  // =========================

  private activePlayer?: PlayerData

  /**
   * App.vue Ä‘Äƒng kÃ½ player sau boot/load â€” update() dÃ¹ng Ä‘á»ƒ tick expiry
   * timed effect theo Date.now().
   */
  setActivePlayer(player: PlayerData) {
    this.activePlayer = player

    // Load save: bá» effect Ä‘Ã£ háº¿t háº¡n ngay (plan Â§9).
    this.tickTimedEffects(player)
  }

  getActiveTimedModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > now)
      .flatMap((effect) => effect.modifiers)
  }

  /**
   * ToÃ n bá»™ modifier Sá»NG cá»§a player: timed effect + socket PhÃ¹/Tráº­n
   * trÃªn slot Ä‘ang cÃ³ equipment. Battle recompute gá»i qua provider má»—i
   * tick â€” effect háº¿t háº¡n giá»¯a tráº­n tá»± rÆ¡i khá»i recompute káº¿ tiáº¿p.
   */
  getActiveRuntimeModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return [...this.getActiveTimedModifiers(player, now), ...this.getSlotModifiers()]
  }

  /**
   * Stack policy MVP (plan Â§5.4): cÃ¹ng effectGroup â†’ refresh deadline
   * (max) vÃ  giá»¯ giÃ¡ trá»‹ máº¡nh hÆ¡n per-modifier; khÃ¡c nhÃ³m â†’ thÃªm má»›i.
   *
   * Merge key theo IDENTITY THá»°C cá»§a modifier: `stat` + `tag` (tag phÃ¢n
   * biá»‡t pool Increased trong runPipeline(), xem StatCalculator) â€” KHÃ”NG
   * dÃ¹ng giÃ¡ trá»‹ `percent` lÃ m key (bug audit P0-1: hai percent khÃ¡c nhau
   * cá»§a cÃ¹ng stat khÃ´ng match vÃ  cá»™ng dá»“n ngoÃ i policy). Khi match, chá»n
   * giÃ¡ trá»‹ máº¡nh hÆ¡n RIÃŠNG cho flat/percent/multiplier Ä‘á»ƒ modifier yáº¿u vÃ 
   * máº¡nh khÃ´ng cÃ¹ng tá»“n táº¡i.
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

  /** Bá» effect háº¿t háº¡n â€” tráº£ sá»‘ effect Ä‘Ã£ rÆ¡i (debug/test). */
  tickTimedEffects(player: PlayerData, now = Date.now()): number {
    const before = player.persistentTimedEffects.length

    player.persistentTimedEffects = player.persistentTimedEffects.filter(
      (effect) => effect.expiresAtMs > now,
    )

    return before - player.persistentTimedEffects.length
  }

  /**
   * TỤ LINH TRẬN (economy-fixes-sinks-plan §3.2 B1, 2026-08-29) — sink
   * Linh Thạch mua % tốc độ tu luyện 24h. Cost leo thang theo số effect
   * CÙNG NHÓM đang active (expiresAtMs > now); chỉ MỘT effect group tồn
   * tại tại 1 thời điểm (stack policy MVP của applyTimedEffect — refresh
   * deadline). Giao dịch atomic: thiếu Linh Thạch → không trừ gì.
   */
  activateTuLinhTran(player: PlayerData, now = Date.now()): { ok: boolean; reason?: string } {
    const activeStacks = player.persistentTimedEffects.filter(
      (effect) => effect.effectGroup === TU_LINH_TRAN_EFFECT_GROUP && effect.expiresAtMs > now,
    ).length

    const cost = getTuLinhTranCost(player.realmId, activeStacks)

    if (!this.materialRegistry.has(cost.materialId) || !this.materialBag.has(cost.materialId, cost.amount)) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    this.materialBag.remove(cost.materialId, cost.amount)

    this.applyTimedEffect(player, {
      id: 'tu_linh_tran',

      sourceItemId: 'tu_linh_tran',

      effectGroup: TU_LINH_TRAN_EFFECT_GROUP,

      appliedAtMs: now,

      expiresAtMs: now + TU_LINH_TRAN_DURATION_MS,

      modifiers: [],

      cultivationSpeedPercent: TU_LINH_TRAN_BUFF_PERCENT,
    })

    return { ok: true }
  }

  /**
   * Nguá»“n DUY NHáº¤T tá»•ng há»£p 2+2 modifier PhÃ¹/Tráº­n trÃªn cÃ¡c slot Ä‘ang cÃ³
   * equipment (plan Â§7.2). Socket modifier giá»¯ sourceId/sourceType á»•n
   * Ä‘á»‹nh Ä‘á»ƒ tooltip/debug truy nguá»“n, KHÃ”NG vÃ o baseStats snapshot.
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

  private getTechniqueTierModifiers(_player: PlayerData): StatModifier[] {
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

    // YÃªu cáº§u 2026-08-26 â€” HP/s & MP/s máº·c Ä‘á»‹nh cá»§a tÃ¢m phÃ¡p: flat trá»±c
    // tiáº¿p lÃªn 2 stat há»“i/giÃ¢y, Ã¡p cho Má»ŒI technique khai tierEffects.
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
   * Má»Ÿ khÃ³a + tá»± equip passive skill á»©ng vá»›i cáº£nh giá»›i hiá»‡n táº¡i cá»§a
   * player â€” gá»i ngay sau breakthrough() thÃ nh cÃ´ng. Nguá»“n passive
   * giá» Ä‘áº¿n tá»« tÃ¢m phÃ¡p ÄANG trang bá»‹ (Technique.passiveSkillIdsByRealm,
   * há»£p nháº¥t 2026-08-15 â€” khÃ´ng cÃ²n slot 'cultivation' riÃªng), khÃ´ng
   * cÃ²n cá»‘ Ä‘á»‹nh theo cáº£nh giá»›i (RealmData.unlockSkillId cÅ©) â€” Ä‘á»•i tÃ¢m
   * phÃ¡p thÃ¬ 9 passive tÆ°Æ¡ng lai cÅ©ng Ä‘á»•i theo, passive Ä‘Ã£ há»c trÆ°á»›c
   * Ä‘Ã³ thÃ¬ giá»¯ nguyÃªn. KhÃ´ng cÃ³ tÃ¢m phÃ¡p nÃ o Ä‘ang trang bá»‹ thÃ¬ khÃ´ng
   * cÃ³ passive nÃ o Ä‘Æ°á»£c há»c. Idempotent (kiá»ƒm tra skillManager.has()
   * trÆ°á»›c khi learn) nÃªn an toÃ n khi gá»i láº·p hoáº·c sau khi load save.
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

    // Passive KHÃ”NG thuá»™c Skill Loadout (khÃ´ng tranh slot vá»›i active
    // skill) â€” equipWithoutSlot() y há»‡t hÃ nh vi equip() cÅ© cho passive.
    this.skillSystem.equipWithoutSlot(skillId)
  }

  /**
   * Realm Passive & Pressure System (2026-08-20) â€” cáº¥p buff VÄ¨NH VIá»„N
   * (Nháº­p Äáº¡o/Kiáº¿n CÆ¡/..., xem data/realm/RealmPassives.ts) cá»§a cáº£nh
   * giá»›i HIá»†N Táº I, tÃªn tÃ¡ch biá»‡t syncRealmPassive() á»Ÿ trÃªn (Ä‘Ã³ lÃ 
   * passive SKILL theo tÃ¢m phÃ¡p, Ä‘Ã¢y lÃ  stat modifier theo Breakthrough
   * Grade/Loáº¡i TrÃºc CÆ¡) Ä‘á»ƒ khá»i nháº§m 2 khÃ¡i niá»‡m. Idempotent (xem
   * RealmPassiveSystem.grantRealmPassive()) â€” gá»i cÃ¹ng 3 Ä‘iá»ƒm vá»›i
   * syncRealmPassive() (chooseCultivationPath() dÆ°á»›i Ä‘Ã¢y,
   * useBreakthrough.ts, useTribulation.ts's resolveVictory()).
   */
  syncRealmStatPassive(player: PlayerData) {
    grantRealmPassive(player, getCurrentRealm(player.realmId).id)
  }

  /**
   * Äáº§u tÆ° Tinh Hoa PhÃ m Thá»ƒ (Ä‘ang cáº§m trong materialBag) vÃ o táº§ng
   * Luyá»‡n Thá»ƒ Ä‘ang dá»Ÿ â€” xem core/realm/BodyRefinementSystem.ts. Tráº£ vá» sá»‘
   * Tinh Hoa tháº­t sá»± Ä‘Ã£ tiÃªu (0 náº¿u khÃ´ng cÃ²n táº§ng nÃ o Ä‘á»ƒ Ä‘áº§u tÆ° hoáº·c
   * khÃ´ng cáº§m Tinh Hoa nÃ o).
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
   * Gate đột phá unified — 1 hàm cho MỌI cảnh giới. Trả về true nếu
   * người chơi đủ điều kiện bấm nút Đột Phá (Quán Khí / Trúc Cơ / ...).
   *
   * PRODUCT SCOPE: game hiện chỉ thiết kế tới Trúc Cơ tầng 18. Các realm
   * placeholder (Kim Đan+) trả false cho tới khi có content pass tương ứng.
   */
  canTriggerBreakthrough(player: PlayerData): boolean {
    if (player.realmId === 'mortal' || player.realmId === 'qi_refining') {
      return player.realmLevel >= CORE_REALM_LEVEL
    }
    return false
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
      // Tráº§n stack Linh Tháº¡ch lÃ  MAX_SAFE_INTEGER nÃªn thá»±c táº¿ khÃ´ng xáº£y
      // ra; náº¿u xáº£y ra thÃ¬ hoÃ n láº¡i pháº©m tháº¥p Ä‘á»ƒ khÃ´ng máº¥t tráº¯ng.
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
   * Quy Ä‘á»•i cáº£nh giá»›i Linh Má»™c/Linh KhoÃ¡ng LÃŠN báº­c káº¿ (2026-08-28): gá»™p
   * 10 báº­c tháº¥p â†’ 1 báº­c cao theo thang PhÃ m NhÃ¢n â†’ Luyá»‡n KhÃ­ â†’ TrÃºc CÆ¡.
   * Gá»— `<realm>_wood` â†’ `<nextRealm>_wood`; quÃ¡ng giá»¯ PHáº¨M khi lÃªn cáº£nh
   * giá»›i `<realm>_ore_<quality>` â†’ `<nextRealm>_ore_<quality>`. CHá»ˆ cÃ³
   * chiá»u lÃªn (giá»¯ sink). Giao dá»‹ch atomic: check Ä‘á»§ â†’ trá»« â†’ cá»™ng; trá»«
   * tháº¥t báº¡i thÃ¬ khÃ´ng cá»™ng.
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

  /**
   * HÓA BÁN (economy-fixes-sinks-plan §3.2 B2, 2026-08-29) — bán nguyên
   * liệu thừa cho Vendor lấy Linh Thạch đúng phẩm. VendorSystem khởi tạo
   * per-call (nhẹ, stateless) với registry + đan phương hiện hành — sole-
   * ingredient guard cần danh sách herbVariants của mọi recipe.
   */
  sellMaterialToVendor(
    materialId: string,
    amount: number,
    player: PlayerData,
  ): { ok: boolean; reason?: string; gained?: number } {
    const vendorSystem = new VendorSystem(this.materialRegistry, this.getAlchemyRecipes())

    const result = vendorSystem.sellMaterial(this.materialBag, materialId, amount, player.realmId)

    if (result.ok && result.gained) {
      this.notifyQuestMaterialGained(
        getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId)),
        result.gained,
      )
    }

    return result
  }

  /**
   * Danh sách material người chơi ĐANG SỞ HỮU và bán được cho Vendor
   * (Ký Bảo Các, 2026-08-30) — dùng cho VendorPanel.vue liệt kê UI, tách
   * khỏi sellMaterialToVendor() (hành động) để panel không tự lặp logic
   * lọc category/giá.
   */
  getVendorSellableRows(
    player: PlayerData,
  ): Array<{ materialId: string; name: string; owned: number; unitPrice: number }> {
    const vendorSystem = new VendorSystem(this.materialRegistry, this.getAlchemyRecipes())

    const rows: Array<{ materialId: string; name: string; owned: number; unitPrice: number }> = []

    for (const stack of this.materialBag.getAll()) {
      const unitPrice = vendorSystem.getUnitSellPrice(stack.material.id, player.realmId)

      if (unitPrice === undefined) {
        continue
      }

      rows.push({
        materialId: stack.material.id,
        name: stack.material.name,
        owned: stack.amount,
        unitPrice,
      })
    }

    return rows
  }

  // =========================
  // EQUIPMENT
  // =========================

  /**
   * W5 (2026-08-27) â€” level KhÃ­ ÄÆ°á»ng giáº£m chi phÃ­ CÆ°á»ng HÃ³a/Táº©y Luyá»‡n/
   * Tinh Luyá»‡n. Äá»“ng bá»™ discount vÃ o EquipmentSystem trÆ°á»›c má»—i query/spend.
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

    this.grantAutoDissolveRewards(this.equipmentBag.add(instance))

    return instance
  }

  /**
   * Cap mềm túi trang bị (audit 2026-08-31) — EquipmentBag.add() tự Hóa
   * Luyện item "rác" nhất khi vượt cap và TRẢ rewards Tinh Hoa cho caller
   * cộng. Null-safe với mock tests (add trả undefined khi bị mock). Cộng
   * qua materialBag + quest hook (mirror dissolveItems()), toast 1 lần
   * mỗi batch qua NotificationQueue sẵn có.
   */
  private grantAutoDissolveRewards(rewards: AutoDissolveReward[] | undefined) {
    const autoDissolved = rewards ?? []

    if (autoDissolved.length === 0) {
      return
    }

    for (const reward of autoDissolved) {
      if (this.materialRegistry.has(reward.materialId)) {
        this.materialBag.add(this.materialRegistry.get(reward.materialId), reward.amount)

        this.notifyQuestMaterialGained(reward.materialId, reward.amount)
      }
    }

    this.notifications.push({
      kind: 'loot',
      message: `Túi đầy — tự Hóa Luyện ${autoDissolved.length} món thành Tinh Hoa`,
    })
  }

  equipItem(instanceId: string, player: PlayerData): { ok: boolean; reason?: string } {
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

  /** CÆ°á»ng HÃ³a gáº¯n SLOT â€” slot trá»‘ng váº«n nÃ¢ng Ä‘Æ°á»£c (slot-level rework). */
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

  /**
   * Task 10 (rework P3) — slot-level enhance: trần là MAX_SLOT_ENHANCE_LEVEL
   * (100 = 10 realm × 10 cấp), KHÔNG còn theo template. Giữ method cho API
   * ổn định; tham số legacy bỏ qua.
   */
  getSlotMaxEnhanceLevel(_slot: EquipmentSlot, _realmId: string): number {
    return MAX_SLOT_ENHANCE_LEVEL
  }

  /** Template tra an toÃ n â€” registry.get() nÃ©m lá»—i vá»›i id láº¡, UI cáº§n undefined. */
  getEquipmentTemplate(itemId: string): Equipment | undefined {
    try {
      return this.equipmentRegistry.get(itemId)
    } catch {
      return undefined
    }
  }

  /** Remaining per-item forge uses (`forgeUsesRemaining`, shown as the forge condition). */
  itemRefinementPoints(instance: EquipmentInstance): number {
    return this.equipmentSystem.itemRefinementPoints(instance)
  }

  /**
   * Wash all affixes using one forge use, quality-scaled equipment essence,
   * and generic spirit stones. Returns a domain reason for presentation.
   */
  washItem(
    instanceId: string,
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    void player

    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.washAffixes(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  /**
   * TINH LUYỆN (plan §7.4) — mỗi dòng eligible không khóa tăng 5–20%
   * rồi clamp theo trần tier; tối đa khóa 3 dòng. Trả về reason lỗi cho UI.
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

  /**
   * Xem trước Tẩy Luyện (2026-08-30, UI "giữ/bỏ") — roll + trừ cost NGAY,
   * KHÔNG ghi affixes mới vào instance. UI giữ affixes trả về ở state
   * tạm, gọi commitWashItem() khi người chơi bấm "Giữ".
   */
  previewWashItem(instanceId: string): { ok: boolean; reason?: string; affixes?: RolledAffix[] } {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.previewWashAffixes(
      instanceId,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.affixRegistry,
    )
  }

  /** Chốt affixes đã preview (previewWashItem) — không trừ cost lần nữa. */
  commitWashItem(instanceId: string, affixes: RolledAffix[]): { ok: boolean; reason?: string } {
    return this.equipmentSystem.commitWashAffixes(
      instanceId,
      affixes,
      this.equipmentBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  /**
   * Xem trước Tinh Luyện (2026-08-30, UI "giữ/bỏ") — cùng cơ chế với
   * previewWashItem/commitWashItem.
   */
  previewRefineItem(
    instanceId: string,
    lockedIndices: readonly number[],
  ): { ok: boolean; reason?: string; values?: RefineValueEntry[] } {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.previewRefineValues(
      instanceId,
      lockedIndices,
      this.equipmentBag,
      this.equipmentRegistry,
      this.materialBag,
      this.affixRegistry,
    )
  }

  /** Chốt values đã preview (previewRefineItem) — không trừ cost lần nữa. */
  commitRefineItem(instanceId: string, values: RefineValueEntry[]): { ok: boolean; reason?: string } {
    return this.equipmentSystem.commitRefineValues(
      instanceId,
      values,
      this.equipmentBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  /** Hủy Refine preview đã trả phí khi UI bỏ kết quả hoặc đổi context. */
  discardRefinePreview(instanceId?: string): void {
    this.equipmentSystem.discardRefinePreview(instanceId)
  }

  /** Discounted Wash cost for UI, keyed by the item's quality. */
  getWashCost(quality: ItemQuality) {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.getWashCost(quality)
  }

  /** Discounted Refine cost for UI, keyed by the item's quality. */
  getRefineCost(
    lineCount: number,
    lockedCount: number,
    quality?: ItemQuality,
  ) {
    this.syncEquipmentCostDiscount()

    return this.equipmentSystem.getRefineCost(lineCount, lockedCount, quality)
  }

  /**
   * HÃ“A LUYá»†N (plan Â§7.5) â€” phÃ¢n giáº£i batch trang bá»‹ thÃ nh Tinh Hoa,
   * all-or-nothing. KhÃ´ng tiÃªu hao Äiá»ƒm RÃ¨n.
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

  /** Preview Tinh Hoa nháº­n Ä‘Æ°á»£c khi HÃ³a Luyá»‡n selection hiá»‡n táº¡i (Â§9.2). */
  previewDissolveRewards(
    instanceIds: readonly string[],
  ): Array<{ materialId: string; minAmount: number; maxAmount: number }> {
    const totals = new Map<string, { min: number; max: number }>()

    for (const instanceId of instanceIds) {
      const instance = this.equipmentBag.get(instanceId)

      if (!instance || instance.equipped || instance.locked || instance.favorite) {
        continue
      }

      const range = ITEM_QUALITY_ESSENCE_RANGE[instance.quality]

      if (!range) {
        continue
      }

      const entry = totals.get(LUYEN_KHI_TINH_HOA_ID) ?? { min: 0, max: 0 }

      entry.min += range.min

      entry.max += range.max

      totals.set(LUYEN_KHI_TINH_HOA_ID, entry)
    }

    return Array.from(totals, ([materialId, value]) => ({
      materialId,

      minAmount: value.min,

      maxAmount: value.max,
    }))
  }

  /**
   * State cÆ°á»ng hÃ³a/formation/bonus affix slots cá»§a 1 slot cá»¥ thá»ƒ â€”
   * dÃ¹ng cho UI hiá»‡n thÃ´ng tin NGAY Cáº¢ KHI slot Ä‘ang trá»‘ng (MASTER
   * SPEC Má»¥c XVI, Phase 9).
   */
  getSlotState(slot: EquipmentSlot): EquipmentSlotState {
    return this.equipmentSlotManager.get(slot)
  }

  getAllSlotStates(): EquipmentSlotState[] {
    return this.equipmentSlotManager.getAll()
  }

  /**
   * Modifier "tÄ©nh" tá»« equipment â€” xem ghi chÃº trong Player.ts vÃ 
   * EquipmentSystem. Chá»‰ Ä‘á»•i khi equip/unequip/enhance, caller
   * (player store) tá»± gÃ¡n láº¡i vÃ o player.modifiers sau má»—i hÃ nh
   * Ä‘á»™ng, KHÃ”NG gá»i má»—i tick nhÆ° getAggregatedModifiers().
   */
  getEquipmentModifiers(): StatModifier[] {
    return this.equipmentSystem.getModifiers()
  }

  /**
   * Task 17 (rework P5) — Đột Phá đại cảnh giới đổi player.realmId nên
   * mọi item đang mặc có thể lệch phẩm mới (Task 16 gate canUseItemGrade
   * chặn re-equip khi lệch, nhưng KHÔNG tự tháo đồ cũ) → tháo TOÀN BỘ
   * trang bị đang mặc ngay sau khi breakthrough để tránh kẹt trạng thái
   * "mặc đồ giờ lệch phẩm nhưng không thể equip lại nếu lỡ tháo tay".
   * Slot state (enhanceLevel/enhanceFailStreak/Formation/Talisman) sống
   * độc lập theo SLOT (MASTER SPEC Mục XVI) — KHÔNG đụng tới, chỉ đổi
   * equipped flag + modifier trên từng EquipmentInstance.
   */
  unequipAllEquipment(): void {
    for (const instance of this.equipmentBag.getEquipped()) {
      this.equipmentSystem.unequip(instance.instanceId, this.equipmentBag)
    }

    this.equipmentSystem.refreshModifiers(
      this.equipmentBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )
  }

  // =========================
  // FORMATION
  // =========================

  // KhÃ´ng cÃ²n nháº­n instanceId (MASTER SPEC Má»¥c XVI, Phase 9) â€” tráº­n

  // =========================
  // RECIPE / CRAFTING (Äan/PhÃ¹/Tráº­n â€” KhÃ­ dÃ¹ng EquipmentSystem, khÃ´ng qua Ä‘Ã¢y)
  // =========================

  // BUILDing spec má»¥c 15-16 â€” Building crafting-station (Äan PhÃ²ng/

  // =========================
  // PILL
  // =========================

  /**
   * Uá»‘ng pill (2026-08-24, plan Â§5.2) â€” ATOMIC consumption: má»i
   * validation + apply thÃ nh cÃ´ng rá»“i má»›i remove khá»i PillBag. Pill
   * nghá» (cÃ³ realmId): gate ÄÃšNG cáº£nh giá»›i + 4 effect MVP; legacy pill
   * (khÃ´ng realmId) giá»¯ hÃ nh vi cÅ©. `random` inject cho main stat roll.
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

    // Exact-realm gate cho pill nghá» (plan Â§5.2).
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

    // Legacy path â€” giá»¯ nguyÃªn hÃ nh vi cÅ© (permanent_stat cap + heal/
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

  /** Gate UI xÃ¢y má»›i â€” delegate BuildingSystem.canBuild (Â§ popover). */
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

    // Fix (review 2026-08-26) â€” build tháº¥t báº¡i trÆ°á»›c Ä‘Ã¢y IM Láº¶NG (null
    // khÃ´ng ai Ä‘á»c): giá» push toast lÃ½ do cá»¥ thá»ƒ Ä‘á»ƒ ngÆ°á»i chÆ¡i biáº¿t pháº£i
    // lÃ m gÃ¬ tiáº¿p (thiáº¿u nguyÃªn liá»‡u/cáº£nh giá»›i...).
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

  /** TÃªn building hiá»ƒn thá»‹ cho toast â€” fallback id khi registry thiáº¿u. */
  private buildingName(buildingId: string): string {
    try {
      return this.buildingRegistry.get(buildingId).name
    } catch {
      return buildingId
    }
  }

  /**
   * Chiue Hien Quan (chi-hien-quan spec 2026-09-02) - NGUON NHAN CONG
   * DUY NHAT: capacity = 1 + level*2 (getWorkerCapacityForLevel). Goi
   * lai sau moi lan build/upgrade CHQ. gathering_outpost KHONG con cap
   * capacity (nguon cu da go - outpost chi con gate San Xuat + linh mach).
   */
  refreshAutoWorkerCapacity(player: PlayerData, instance: BuildingInstance): void {
    if (instance.buildingId !== 'chi_hien_quan') {
      return
    }

    player.autoWorkerCapacity = getWorkerCapacityForLevel(instance.level)
  }

  /**
   * Chi-hien-quan (2026-09-02) — assignments snapshot từ production states
   * (assignedWorkers persist trong save) — truyền vào tickWorkers/
   * settleOffline để OFFLINE KHỚP ONLINE.
   */
  getWorkerAssignments(): Map<string, number> {
    const assignments = new Map<string, number>()

    for (const state of this.productionSystem.getAllStates()) {
      if (state.assignedWorkers !== undefined) {
        assignments.set(state.siteId, state.assignedWorkers)
      }
    }

    return assignments
  }

  /**
   * Chi-hien-quan (2026-09-02) — UI phân bổ: gán/xóa số slot manual của
   * 1 site. `count === undefined` = về AUTO (xóa assignedWorkers).
   * Clamp [0, capacity] phòng UI gửi sai; không đổi nếu site không tồn tại.
   */
  assignWorkers(siteId: string, count: number | undefined): void {
    const state = this.productionSystem.getState(siteId)

    if (!state) {
      return
    }

    if (count === undefined) {
      delete state.assignedWorkers

      return
    }

    const capacity = this.activePlayer?.autoWorkerCapacity ?? 0

    // NaN (UI path lỗi) coi như 0 — không để assignedWorkers = NaN
    // phá regex phân bổ tickWorkers.
    const safeCount = Number.isFinite(count) ? count : 0

    state.assignedWorkers = Math.max(0, Math.min(Math.floor(safeCount), capacity))
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
  // Linh Tuyá»n (producesMaterialId) â€” thu hoáº¡ch Ä‘á»• vÃ o MaterialBag nhÆ°
  // material bÃ¬nh thÆ°á»ng (plan Workstream F); claim() tráº£ amount +
  // materialId, GameManager resolve template vÃ  cá»™ng bag.
  collectBuilding(instanceId: string, player: PlayerData, currentTime = Date.now() / 1000): number {
    // Pre-check registry TRÆ¯á»šC khi claim reset má»‘c thá»i gian (review
    // 2026-08-28): náº¿u materialId khÃ´ng resolve Ä‘Æ°á»£c mÃ  váº«n claim, sáº£n
    // lÆ°á»£ng bá»‹ máº¥t tráº¯ng (má»‘c Ä‘Ã£ reset, bag khÃ´ng Ä‘Æ°á»£c cá»™ng).
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
  // PRODUCTION (2026-08-25 â€” LÃ¢m/QuÃ¡ng/Äá»™ng ThiÃªn, plan Â§4/Â§9)
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

  /** Báº¯t Ä‘áº§u cycle táº¡i cáº£nh giá»›i HIá»†N Táº I cá»§a player (snapshot Â§4.1). */
  startProductionCycle(siteId: string, player: PlayerData): boolean {
    return this.productionSystem.startCycle(siteId, player.realmId, Date.now())
  }

  setProductionAutoRestart(siteId: string, enabled: boolean): boolean {
    return this.productionSystem.setAutoRestart(siteId, enabled)
  }

  /** NÃ¢ng level nguá»“n â€” cost Gá»— + Linh Tháº¡ch (sink chÃ­nh cá»§a LÃ¢m, Â§5.2). */
  upgradeProductionSite(siteId: string, player: PlayerData): boolean {
    // Plan Workstream F â€” Linh Tháº¡ch check/trá»« trá»±c tiáº¿p trÃªn MaterialBag.
    return this.productionSystem.upgradeSite(siteId, this.materialBag, getRealmTier(player.realmId))
  }

  getProductionUpgradeCost(siteId: string) {
    return this.productionSystem.getSiteDefinition(siteId)?.upgradeCosts
  }

  // =========================
  // ALCHEMY (Äan PhÃ²ng â€” plan Â§8)
  // =========================

  getAlchemyRecipes(): AlchemyRecipe[] {
    return Array.from(this.alchemyRecipesById.values())
  }

  getAlchemyRecipe(recipeId: string): AlchemyRecipe | undefined {
    return this.alchemyRecipesById.get(recipeId)
  }

  /** Level Äan PhÃ²ng (pill_room) hiá»‡n hÃ nh â€” chÆ°a xÃ¢y = 0. */
  getAlchemyRoomLevel(): number {
    return this.buildingManager.getByBuildingId('pill_room')?.level ?? 0
  }

  getAlchemyJobs(): ActiveAlchemyJob[] {
    return this.alchemySystem.getJobs()
  }

  /**
   * Báº¯t Ä‘áº§u luyá»‡n Ä‘an â€” reserve nguyÃªn liá»‡u ATOMIC (Â§8.2); slot job theo
   * concurrent_job_slots effect cá»§a pill_room (máº·c Ä‘á»‹nh 1).
   */
  startAlchemyJob(
    recipeId: string,
    herbMaterialId: string,
    _player: PlayerData,
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

    // Bugfix (review 2026-08-26) â€” Linh Tháº¡ch Ä‘Æ°á»£c CHECK á»Ÿ startJob
    // nhÆ°ng chÆ°a tá»«ng Ä‘Æ°á»£c TRá»ª: luyá»‡n Ä‘an miá»…n phÃ­. Trá»« sau khi reserve
    // nguyÃªn liá»‡u thÃ nh cÃ´ng (all-or-nothing nhÆ° má»i sink khÃ¡c).
    // Plan Workstream F â€” trá»« trÃªn MaterialBag.
    if (started.ok && recipe.spiritStoneCost > 0) {
      this.materialBag.remove(spiritStoneId, recipe.spiritStoneCost)
    }

    return started
  }

  cancelAlchemyJob(jobId: string): boolean {
    return this.alchemySystem.cancelJob(jobId)
  }

  /** Preview tá»•ng tá»· lá»‡ thÃ nh + guaranteed + chance viÃªn cá»™ng thÃªm (Â§9.3). */
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

    // Spawn placement (plan Â§5.1) â€” row/column do resolver roll trong
    // queueEnemySpawn (Boss luÃ´n row 4); khÃ´ng cÃ²n gÃ¡n lane ngoÃ i.

    // Reset máº·c Ä‘á»‹nh â€” startBattleWithPlayer() sáº½ set láº¡i session
    // (receiver/player) tháº­t ngay sau lá»‡nh gá»i nÃ y. Battle báº¯t Ä‘áº§u qua
    // startBattle() trá»±c tiáº¿p (khÃ´ng pháº£i PlayerData) thÃ¬ khÃ´ng cÃ³ ai
    // nháº­n thÆ°á»Ÿng hay Ä‘á»“ rÆ¡i (equipment cáº§n player Ä‘á»ƒ roll chá»‰ sá»‘ chÃ­nh).
    // Stack passive (vd Linh KhÃ­ Cáº£m á»¨ng +cÃ´ng kÃ­ch/Ä‘Ã²n trÃºng) lÃ 
    // buff TRONG TRáº¬N â€” reset vá» 0 má»—i khi 1 tráº­n má»›i báº¯t Ä‘áº§u, ká»ƒ cáº£
    // khi Auto tá»± ná»‘i tráº­n ngay láº­p tá»©c (theo yÃªu cáº§u, khÃ¡c thiáº¿t káº¿
    // permanent progression ban Ä‘áº§u).
    this.battleLoot.beginBattle()
    this.passiveSystem.resetStacks()

    // Báº¥t Tá»­ Thá»ƒ â€” reset máº·c Ä‘á»‹nh vá» KHÃ”NG báº£o vá»‡; startBattleWithPlayer()
    // sáº½ set láº¡i session tháº­t ngay sau (cÃ¹ng pattern battleLoot.setSession()).
    // Tráº­n startBattle() trá»±c tiáº¿p (khÃ´ng PlayerData) thÃ¬ khÃ´ng cÃ³ thiÃªn phÃº.
    this.combatSystem.setSurviveLethalSession(null)

    this.battleSystem.start(player, enemyEntity)
  }

  getBattleRewardSummary(): BattleRewardSummary {
    return this.battleLoot.getSummary()
  }

  /**
   * Tiá»‡n Ã­ch: báº¯t Ä‘áº§u tráº­n Ä‘áº¥u tháº³ng tá»« PlayerData thay vÃ¬ pháº£i
   * tá»± convert sang CombatEntity trÆ°á»›c. `playerStats` truyá»n vÃ o
   * pháº£i lÃ  finalStats (Ä‘Ã£ cá»™ng modifiers) â€” láº¥y tá»«
   * player store getter `finalStats`, khÃ´ng tÃ­nh láº¡i á»Ÿ Ä‘Ã¢y Ä‘á»ƒ
   * trÃ¡nh 2 nÆ¡i tá»± gá»i calculateStats() khÃ¡c nhau.
   */
  startBattleWithPlayer(player: PlayerData, playerStats: Stats, enemy: Enemy) {
    // DESIGN: má»i chá»‰ sá»‘ combat, gá»“m skill runtime stats, Ä‘Æ°á»£c snapshot lÃºc
    // báº¯t Ä‘áº§u tráº­n. Mua node/Ä‘á»•i trang bá»‹/loadout giá»¯a tráº­n chá»‰ cÃ³ hiá»‡u lá»±c tá»«
    // tráº­n káº¿ tiáº¿p; khÃ´ng Ä‘á»¥ng tá»›i CombatEntity Ä‘ang chiáº¿n Ä‘áº¥u.
    //
    // Runtime authority (2026-08-24, plan Â§5.4): `playerStats` lÃ  snapshot
    // TÄ¨NH (getAggregatedModifiers chá»‰ tráº£ static â€” runtime khÃ´ng náº±m á»Ÿ
    // Ä‘Ã³); timed effect + socket modifier cháº£y vÃ o combat qua provider
    // Má»–I TICK (updateStatsFromModifiers) â†’ effect háº¿t háº¡n giá»¯a tráº­n tá»±
    // trá»Ÿ vá» baseline, khÃ´ng double-apply, khÃ´ng Ä‘Ã³ng bÄƒng trong baseStats.
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

    // Báº¥t Tá»­ Thá»ƒ (talent-direction-choice-plan Â§6) â€” reset lÆ°á»£t sá»‘ng sÃ³t
    // theo thiÃªn phÃº cá»§a player má»—i tráº­n Má»šI rá»“i gáº¯n session cho
    // combatSystem.killIfDead(). playerEntity.id lÃ  'player' (xem
    // playerToCombatEntity()).
    this.surviveLethalGuard.beginBattle(player.selectedTalentIds)
    this.combatSystem.setSurviveLethalSession({
      playerEntityId: playerEntity.id,
      guard: this.surviveLethalGuard,
    })

    // Báº£n Má»‡nh PhÃ¡p Báº£o â€” snapshot level/grade/path/equippedElements
    // NGAY lÃºc tráº­n báº¯t Ä‘áº§u (doc Â§11); undefined náº¿u player khÃ´ng cÃ³
    // artifact (Kiáº¿m Tu/chÆ°a TrÃºc CÆ¡) â€” updateArtifactActivation() tá»±
    // no-op trong trÆ°á»ng há»£p Ä‘Ã³.
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
   * RewardReceiver dÃ¹ng chung cho má»i nÆ¡i cáº¥p Reward trá»±c tiáº¿p cho
   * player (battle victory, claim quest...) â€” insight Ä‘á»• vÃ o tÃ¢m phÃ¡p
   * Ä‘ang trang bá»‹, Linh Tháº¡ch Ä‘á»• vÃ o MaterialBag (Plan Workstream F).
   */
  private buildPlayerRewardReceiver(player: PlayerData): RewardReceiver {
    return createPlayerRewardReceiver(
      player,
      (amount) => this.gainEquippedTechniqueInsight(amount),
      (amount) => {
        // Cáº¥p ÄÃšNG pháº©m Linh Tháº¡ch theo cáº£nh giá»›i hiá»‡n táº¡i (khá»›p pháº©m mÃ 
        // chi phÃ­ Äá»™t PhÃ¡/CÆ°á»ng HÃ³a/nÃ¢ng cáº¥p cÃ´ng trÃ¬nh Ä‘Ã²i há»i á»Ÿ cáº£nh
        // giá»›i Ä‘Ã³) â€” khÃ´ng cáº¥p cá»©ng Háº¡ Pháº©m khiáº¿n ngÆ°á»i chÆ¡i cáº£nh giá»›i
        // cao káº¹t láº¡i vÃ¬ cÃ³ Linh Tháº¡ch nhÆ°ng sai pháº©m.
        const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

        if (amount > 0 && this.materialRegistry.has(spiritStoneId)) {
          this.materialBag.add(this.materialRegistry.get(spiritStoneId), amount)

          this.notifyQuestMaterialGained(spiritStoneId, amount)
        }
      },
    )
  }

  // =========================
  // QUEST (Nhiá»‡m Vá»¥)
  // =========================

  /**
   * Collect-quest hook (review 2026-08-28 bug #3) â€” gá»i Má»–I KHI material
   * vÃ o tÃºi ngÆ°á»i chÆ¡i Ä‘á»ƒ tÄƒng progress collect-quest Ä‘ang active. KHÃ”NG
   * gá»i khi restore tá»« save (double-count). BattleLootSystem tá»± gá»i trá»±c
   * tiáº¿p (cÃ³ deps quest); cÃ¡c Ä‘Æ°á»ng cá»™ng material cÃ²n láº¡i cá»§a GameManager
   * (production settle, claim toÃ  nhÃ , HÃ³a Luyá»‡n, Linh Tháº¡ch reward...)
   * Ä‘i qua helper nÃ y.
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

    * Độ Kiếp (spec dot-pha-loi-kiep §5.1) — delegate xuống
    * TribulationDirector (runtime chương kiếp mới: tâm ma + tank lôi,
    * KHÔNG qua BattleSystem, không quái Kiếp). hasTrucCoDan đọc từ
    * PillBag (vật chứng bậc Địa/Thiên, không tiêu). Bất Tử Thể không áp
    * trong kiếp (nghi lễ thật — giữ pattern cũ): kiếp không qua combat
    * nên không có session nào để xoá.
    */

  startTribulation(
    player: PlayerData,
    playerStats: Stats,
    targetRealmId: string,
  ): boolean {
    const hasTrucCoDan = this.pillBag.has('truc_co_dan', 1)

    return this.tribulationDirector.start(player, playerStats, hasTrucCoDan, targetRealmId)
  }


  /** Trả lời câu hỏi tâm ma hiện tại (overlay Vue gọi qua facade này). */
  answerTribulationQuestion(answerIndex: number): boolean {
    return this.tribulationDirector.answerQuestion(answerIndex)

  }

  getTribulationCooldownSeconds(now = Date.now()): number {
    return this.tribulationDirector.getCooldownSeconds(now)
  }

  getActiveTribulation(): ActiveTribulationState | null {
    return this.tribulationDirector.getState()
  }

  clearActiveTribulation() {
    this.tribulationDirector.clear()
  }

  /**
   * Ãp 1 buff/debuff PERSISTENT (ngoÃ i tráº­n) lÃªn player â€” dÃ¹ng cho
   * Kiáº¿p ThÆ°Æ¡ng khi tháº¥t báº¡i Äá»™ Kiáº¿p (má»¥c 13 spec `breakthrough`).
   * CÃ¹ng buffSystem/buffManager nuÃ´i getAggregatedModifiers() má»—i
   * tick (xem PillSystem's effect 'buff' â€” cÃ¹ng cÆ¡ cháº¿).
   */
  // Unified Buff System (Task 9b, fix round 2) - BuffSystem.apply() now
  // requires a real source/target CombatEntity (to read
  // ailmentResistPercent/ailmentDurationPercent for duration scaling),
  // even for a buff with no dot effect like KIEP_THUONG_DEBUFF.
  // `stats` (the caller's already-calculateStats()'d Stats, same
  // `player.finalStats` pattern startTribulation()/startBattleWithPlayer()
  // already use - see useTribulation.ts's resolveDefeat()) lets us build
  // the REAL player CombatEntity via playerToCombatEntity() (same helper
  // battle start uses), so this debuff's resist/duration correctly reads
  // the player's actual gear. Falls back to the in-battle entity if one
  // somehow exists, then to a fully-populated neutral ghost only if
  // neither is available (today: only reachable if a caller forgets to
  // pass `stats` - see resolvePersistentBuffEntity()).
  applyPersistentBuff(buff: BuffDefinition, stats?: Stats) {
    const entity = this.resolvePersistentBuffEntity(stats)

    this.buffSystem.apply(buff, entity, entity, this.buffRegistry)
  }

  // Shared entity resolution for applyPersistentBuff() and the per-tick
  // buffSystem.update() call in tick() - both need 1 CombatEntity to hand
  // BuffSystem, and neither has one implicitly guaranteed outside battle
  // (GameManager keeps no persistent player CombatEntity of its own; only
  // playerToCombatEntity() at battle start, which needs `Stats` already
  // calculateStats()'d by the Pinia store - GameManager deliberately
  // avoids calling calculateStats() itself to prevent 2 divergent call
  // sites, see startBattleWithPlayer()'s note). Preference order: real
  // in-battle entity > real player entity built from caller-supplied
  // `stats` (mirrors startBattleWithPlayer()'s own construction) > fully-
  // populated neutral ghost.
  private resolvePersistentBuffEntity(stats?: Stats): CombatEntity {
    const activeBattle = this.battleSystem.getBattle()

    if (activeBattle) {
      return activeBattle.player
    }

    if (stats && this.activePlayer) {
      return playerToCombatEntity(this.activePlayer, stats, this.getSkillRuntimeStats(this.activePlayer))
    }

    return this.createPersistentBuffGhostEntity()
  }

  // Fully-populated neutral placeholder CombatEntity (no gear, no active
  // buffs, every non-optional CombatEntity field explicitly set - NOT an
  // `as CombatEntity` cast papering over missing fields) used only when
  // resolvePersistentBuffEntity() has neither a real in-battle entity nor
  // caller-supplied Stats to build one from. Safe even for a future
  // persistent buff with a `dot` effect (combatSystem.applyDotDamage()
  // would read real currentHp/maxHp/alive, not undefined).
  private createPersistentBuffGhostEntity(): CombatEntity {
    const stats = createBaseStats()

    return {
      id: 'player',
      name: this.activePlayer?.name ?? 'player',
      type: 'player',
      baseStats: stats,
      stats,
      currentHp: stats.maxHp,
      maxHp: stats.maxHp,
      currentMp: stats.maxMp,
      currentSwordIntent: 0,
      currentMomentum: 0,
      currentHoaThe: 0,
      currentThoThe: 0,
      currentKimThe: 0,
      timeSinceLastBleedProc: 0,
      currentWard: 0,
      timeSinceLastHitTaken: Infinity,
      realmIndex: 0,
      x: 0,
      row: HERO_LANE_INDEX,
      alive: true,
      tuLucActive: false,
      tuLucElapsed: 0,
      tuLucDamageTakenPercent: 0,
    }
  }

  giveReward(receiver: RewardReceiver, reward: Reward) {
    this.rewardSystem.give(receiver, reward)
  }

  /**
   * NgÆ°á»i chÆ¡i CHá»¦ Äá»˜NG thoÃ¡t tráº­n giá»¯a chá»«ng (nÃºt "ThoÃ¡t Tráº­n" á»Ÿ
   * CombatControlBar.vue, cÃ³ xÃ¡c nháº­n trÆ°á»›c khi gá»i tá»›i Ä‘Ã¢y) â€” TÃI
   * DÃ™NG luá»“ng 'defeat' sáºµn cÃ³ thay vÃ¬ dá»±ng 1 BattleState/UI má»›i:
   * chá»‰ set battle.state + emit 'battle_end' giá»‘ng há»‡t
   * BattleSystem.checkBattleEnd() lÃ m khi player cháº¿t.
   * updateStageProgress() Tá»° dá»«ng stageManager á»Ÿ tick káº¿ tiáº¿p khi tháº¥y
   * state 'defeat' (xem ghi chÃº á»Ÿ Ä‘Ã³) â€” khÃ´ng cáº§n tá»± dá»n gÃ¬ thÃªm á»Ÿ
   * Ä‘Ã¢y. Pháº§n thÆ°á»Ÿng Ä‘Ã£ kiáº¿m Ä‘Æ°á»£c (grantBattleRewardIfNeeded() cháº¡y
   * Má»–I TICK theo tá»«ng quÃ¡i cháº¿t, khÃ´ng Ä‘á»£i tá»›i cuá»‘i tráº­n) KHÃ”NG máº¥t
   * dÃ¹ thoÃ¡t giá»¯a chá»«ng. Chá»‰ Ã¡p dá»¥ng tráº­n Stage â€” Tribulation (Äá»™t
   * PhÃ¡) cÃ³ luá»“ng tháº¯ng/thua RIÃŠNG (useTribulation.ts), nÃºt "ThoÃ¡t
   * Tráº­n" khÃ´ng hiá»‡n trong tráº­n Ä‘Ã³ (xem CombatControlBar.vue).
   */
  abandonBattle(): boolean {
    const battle = this.battleSystem.getBattle()

    if (!battle || (battle.state !== 'countdown' && battle.state !== 'fighting')) {
      return false
    }

    battle.state = 'defeat'
    this.stageWaves.stopRepeat()

    this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })

    // Audit fix 2026-08-31 — enemy sống + pending spawn của trận bị bỏ không
    // qua victory flow (processDefeatedEnemies despawn) → orphan vĩnh viễn
    // trong EnemyManager. Clear ở ĐÚNG điểm hủy trận, không đụng flow victory
    // (StageWave auto-repeat spawn trận mới ngay sau victory).
    this.enemyManager.clear()

    return true
  }

  // =========================
  // STAGE (wave spawn)
  // =========================
  // VÃ²ng Ä‘á»i wave (spawn nhá»‹p, victory, auto-repeat, boss summon) náº±m á»Ÿ
  // StageWaveSystem â€” cÃ¡c method dÆ°á»›i Ä‘Ã¢y lÃ  delegate giá»¯ public API.

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
   * Validate registry-backed save references without mutating any restore owner.
   * App calls this before Pinia restore; restoreFromSave repeats it defensively.
   */
  preflightSaveRegistryReferences(save: GameSave): void {
    for (const instance of save.equipment) {
      if (!this.equipmentRegistry.has(instance.itemId)) {
        throw new Error(`Unknown equipment template in save: ${instance.itemId}`)
      }

      for (const affix of instance.affixes) {
        if (!this.affixRegistry.has(affix.affixId)) {
          throw new Error(`Unknown equipment affix in save: ${affix.affixId}`)
        }
      }
    }
  }

  /**
   * Restore persisted state into the corresponding managers. Call only after
   * registerMaterials/registerEquipment/registerAffixes/registerPills/
   * registerTalismans/registerSkillTemplates/registerTechniqueTemplates have
   * populated every ID-backed registry.
   *
   * Returns the latest equipment modifiers so the caller can synchronize them
   * into player.modifiers; EquipmentSystem does not own the player store.
   */
  restoreFromSave(save: GameSave): StatModifier[] {
    this.preflightSaveRegistryReferences(save)

    for (const technique of save.techniques) {
      if (!this.techniqueManager.has(technique.id)) {
        // Text-refresh-on-load: cung logic voi skill ben duoi -- name/
        // description la du lieu hien thi thuan, luon dong bo tu template
        // dang dang ky thay vi giu nguyen ban da dong bang trong save cu.
        const template = this.techniqueTemplates.get(technique.id)

        if (template) {
          technique.name = template.name
          technique.description = template.description
        }

        this.techniqueManager.add(technique)
      }
    }

    for (const skill of save.skills) {
      if (this.skillManager.has(skill.id)) {
        continue
      }

      // Execution policy rework + development-build no-migration (2026-
      // 08-26): save cá»§a nhÃ¢n váº­t CÅ¨ lÆ°u skill object nguyÃªn tráº¡ng trÆ°á»›c
      // khi cÃ³ field `execution` báº¯t buá»™c â€” scheduler thá»‘ng nháº¥t Bá»Ž QUA
      // má»i active thiáº¿u execution ("khÃ´ng cast gÃ¬" dÃ¹ tele/di chuyá»ƒn
      // váº«n cháº¡y). Äá»‘i chiáº¿u template Ä‘Ã£ Ä‘Äƒng kÃ½ Ä‘á»ƒ há»“i phá»¥c AUTHORED
      // combat data (execution/targeting/AOE/VFX preset), giá»¯ NGUYÃŠN
      // progression state cá»§a instance (level/equipped/slot/cooldown/
      // specialization). Template thiáº¿u thÃ¬ giá»¯ nguyÃªn object save.
      const template = this.skillTemplates.get(skill.id)

      if (!skill.execution && template?.execution) {
        skill.execution = structuredClone(template.execution)
      }

      if (!skill.targeting && template?.targeting) {
        skill.targeting = structuredClone(template.targeting)
      }

      // Text-refresh-on-load: name/description la du lieu HIEN THI THUAN
      // (khong phai progression), nen luon dong bo lai tu template dang
      // dang ky thay vi giu nguyen ban da dong bang trong save cu. Vi du
      // that da gap: 1 save cu tung luu "Huy Kiem" luc description bi
      // hong encoding (mojibake) -- sua Skills.ts khong tu hoi phuc cac
      // save da luu truoc do neu thieu buoc nay.
      if (template) {
        skill.name = template.name
        skill.description = template.description
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

    // PhÃ¹/Tráº­n legacy (plan Â§10.1): save Ä‘Ã£ qua migration v44 cÃ³ máº£ng
    // rá»—ng â€” bá» qua hoÃ n toÃ n, khÃ´ng cÃ²n bag Ä‘á»ƒ náº¡p.

    // Cap mềm (audit 2026-08-31) — restore save quá cap: tự Hóa Luyện
    // phần tràn, GOM rewards cả batch để cộng material + toast đúng 1
    // LẦN cuối vòng (auto-dissolve chạy ngay trong từng add() nhưng
    // người chơi không cần 500 toast). KHÔNG gọi quest hook tại đây —
    // notifyQuestMaterialGained() phải bỏ qua restore (double-count,
    // xem ghi chú tại hàm đó).
    let restoredAutoDissolved: AutoDissolveReward[] = []

    for (const instance of save.equipment) {
      restoredAutoDissolved = [...restoredAutoDissolved, ...(this.equipmentBag.add(instance) ?? [])]
    }

    for (const reward of restoredAutoDissolved) {
      if (this.materialRegistry.has(reward.materialId)) {
        this.materialBag.add(this.materialRegistry.get(reward.materialId), reward.amount)
      }
    }

    if (restoredAutoDissolved.length > 0) {
      this.notifications.push({
        kind: 'loot',
        message: `Túi đầy — tự Hóa Luyện ${restoredAutoDissolved.length} món thành Tinh Hoa`,
      })
    }

    // MASTER SPEC Má»¥c XVI (Phase 9) â€” slot state (enhance) PHáº¢I náº¡p
    // trÆ°á»›c refreshModifiers() bÃªn dÆ°á»›i.
    this.equipmentSlotManager.restore(save.equipmentSlots)

    // ModifierSystem ná»™i bá»™ cá»§a equipmentSystem khÃ´ng tá»± phá»¥c há»“i
    // theo EquipmentBag vá»«a náº¡p â€” pháº£i build láº¡i thá»§ cÃ´ng.
    this.equipmentSystem.refreshModifiers(
      this.equipmentBag,
      this.equipmentSlotManager,
      this.affixRegistry,
    )

    this.buildingManager.restore(save.buildings)

    // Chi Hien Quan (chi-hien-quan spec) — re-apply worker capacity từ
    // instance CHQ trong save (autoWorkerCapacity trong save có thể stale
    // — công thức là source of truth, không tin field đã lưu).
    if (this.activePlayer) {
      const chiHienQuan = this.buildingManager.getByBuildingId('chi_hien_quan')

      if (chiHienQuan) {
        this.refreshAutoWorkerCapacity(this.activePlayer, chiHienQuan)
      }
    }

    this.questManager.restore(
      save.quests ?? { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    )

    // Production (plan Â§4.3) â€” restore state + offline settle tuáº§n tá»±
    // trong cap; Má»–I auto-cycle má»™t seed/roll riÃªng.
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
        // T3 (economy-ecosystem-plan) â€” worker cháº¡y offline nhÆ° slot tay
        // trong cap: truyá»n capacity + má»‘c báº¯t Ä‘áº§u váº¯ng máº·t Ä‘á»ƒ settle
        // Ä‘Ãºng cá»­a sá»•.
        this.productionSystem.settleOffline(
          this.materialBag,
          this.materialRegistry,
          this.activePlayer.realmId,
          Date.now(),
          {
            workerCapacity: this.activePlayer.autoWorkerCapacity ?? 0,
            offlineSinceMs: save.player.lastSavedAt ?? Date.now(),
            workerAssignments: this.getWorkerAssignments(),
          },
        )
      }
    }

    // Äan PhÃ²ng offline settle (Â§8.2).
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
   * Gá»i má»—i tick tá»« game loop (App.vue) vá»›i deltaSeconds Ä‘o Ä‘Æ°á»£c
   * tá»« GameClock. GameManager chá»‰ forward xuá»‘ng cÃ¡c system cÃ³
   * tráº¡ng thÃ¡i phá»¥ thuá»™c thá»i gian â€” khÃ´ng tá»± tÃ­nh thá»i gian.
   */
  update(deltaSeconds: number) {
    if (deltaSeconds <= 0) {
      return
    }

    // Timed effect theo thá»i gian thá»±c â€” tick expiry á»Ÿ Má»ŒI update (cáº£
    // khi pause battle) vÃ¬ deadline lÃ  Date.now() tuyá»‡t Ä‘á»‘i, khÃ´ng dÃ¹ng
    // game delta kÃ©o dÃ i buff (plan Â§5.4). Player reference do App.vue
    // Ä‘Äƒng kÃ½ qua setActivePlayer() sau boot/load.
    if (this.activePlayer) {
      this.tickTimedEffects(this.activePlayer)

      // Quest daily reset (Quest System plan) â€” wall-clock day-bucket,
      // check má»—i tick nÃªn váº«n reset ká»ƒ cáº£ khi panel Nhiá»‡m Vá»¥ Ä‘ang Ä‘Ã³ng.
      if (
        this.questSystem.checkAndResetDaily(
          this.questRegistry,
          this.questManager,
          this.activePlayer,
        )
      ) {
      this.notifications.push({ kind: 'craft', message: 'Nhiệm vụ hàng ngày đã làm mới' })
      }

      // Production settle (plan Â§4.3) â€” delivery tháº³ng Bag khi cycle
      // hoÃ n thÃ nh; notification ghi rÃµ váº­t liá»‡u + sá»‘ lÆ°á»£ng (Â§9.1).
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
        this.getWorkerAssignments(),
      )

      for (const event of this.productionSystem.drainSettlementEvents()) {
        const material = this.materialRegistry.has(event.materialId)
          ? this.materialRegistry.get(event.materialId)
          : undefined

        // Collect-quest hook (review 2026-08-28) â€” production settle lÃ 
        // nguá»“n material chÃ­nh cá»§a collect-quest. Chá»‰ tÃ­nh lÆ°á»£ng tháº­t sá»±
        // vÃ o tÃºi (trá»« overflow).
        this.notifyQuestMaterialGained(event.materialId, event.amount - (event.overflow ?? 0))

        this.notifications.push({
          kind: 'loot',
          message: `${material?.name ?? event.materialId} ×${event.amount}`,
        })
      }

      // Äan PhÃ²ng settle (Â§8.3). ThiÃªn phÃº Äan DuyÃªn cá»™ng Ä‘iá»ƒm % thÃ nh
      // Ä‘an (plan Â§6) â€” Ä‘á»c tá»« activePlayer má»—i tick, Ä‘á»•i talent lÃ  cÃ³ hiá»‡u lá»±c.
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
            ? `${pill?.name ?? event.pillId} x${event.pills}`
            : `Luyện ${pill?.name ?? event.pillId} thất bại`,
        })
      }

      // Task 14 (rework P4) — Tab Phân Giải cycle: khoáng → tinh hoa.
      this.decomposeSystem.tick(Date.now())

      for (const entry of this.decomposeSystem.drainOutput()) {
        const tinhHoa = this.materialRegistry.has(entry.materialId)
          ? this.materialRegistry.get(entry.materialId)
          : undefined

        this.materialBag.add(tinhHoa ?? { id: entry.materialId, name: entry.materialId } as never, entry.amount)

        this.notifications.push({
          kind: 'craft',
          message: `Phân Giải +${entry.amount} ${(tinhHoa as { name?: string } | undefined)?.name ?? 'Tinh Hoa'}`,
        })
      }
    }

    // Task 9b: BuffSystem.update() now requires a real target:
    // CombatEntity + combatSystem: CombatSystem (see BuffSystem.update()).
    // No `Stats` naturally available in this per-tick scope (see
    // resolvePersistentBuffEntity()'s note), so this resolves to the
    // real in-battle entity when one exists, else the fully-populated
    // neutral ghost.
    this.buffSystem.update(
      deltaSeconds,
      this.resolvePersistentBuffEntity(),
      this.combatSystem,
      this.buffRegistry,
    )

    // cooldownReduction Ä‘á»c tá»« battle.player.stats (CombatEntity) Ä‘ang
    // sá»‘ng trong tráº­n náº¿u cÃ³ â€” ngoÃ i combat (menu/mÃ n hÃ¬nh cáº£nh giá»›i)
    // khÃ´ng cÃ³ battle nÃ o thÃ¬ máº·c Ä‘á»‹nh 0, khá»›p hÃ nh vi cÅ©.
    const activeBattle = this.battleSystem.getBattle()

    this.skillSystem.update(deltaSeconds, activeBattle?.player.stats.cooldownReduction ?? 0)

    this.passiveSystem.tick(deltaSeconds)

    this.updateBattleFixedStep(deltaSeconds)
  }

  /**
   * Chia deltaSeconds thÃ nh cÃ¡c bÆ°á»›c cá»‘ Ä‘á»‹nh BATTLE_FIXED_STEP_SECONDS
   * cho nhÃ¡nh phá»¥ thuá»™c timer-Ä‘áº¿m-ngÆ°á»£c-rá»“i-reset (Ä‘Ã²n Ä‘Ã¡nh, spawn
   * quÃ¡i, pháº§n thÆ°á»Ÿng) â€” xem ghi chÃº á»Ÿ BATTLE_FIXED_STEP_SECONDS phÃ­a
   * trÃªn. Giá»›i háº¡n á»Ÿ BATTLE_MAX_CATCHUP_SECONDS Ä‘á»ƒ khÃ´ng láº·p hÃ ng ngÃ n
   * bÆ°á»›c khi deltaSeconds báº¥t thÆ°á»ng lá»›n.
   *
   * updateTribulation()/updateTribulationProgress() CHá»¦ Ã Ä‘á»©ng NGOÃ€I
   * vÃ²ng láº·p bÆ°á»›c nhá»: updateTribulation() Ä‘Ã£ tá»± cÃ³ vÃ²ng láº·p catch-up
   * riÃªng (while nextStrikeInSeconds <= 0) hoáº¡t Ä‘á»™ng Ä‘Ãºng vá»›i deltaSeconds
   * lá»›n dáº¡ng Ä‘Ã³ng (khÃ´ng tÃ­ch luá»¹ theo bÆ°á»›c), gá»i 1 láº§n vá»›i deltaSeconds
   * gá»‘c lÃ  chÃ­nh xÃ¡c. Chia nhá» nÃ³ thÃ nh hÃ ng trÄƒm bÆ°á»›c 0.1s sáº½ Cá»˜NG Dá»’N
   * sai sá»‘ dáº¥u pháº©y Ä‘á»™ng (0.1 khÃ´ng biá»ƒu diá»…n cháºµn nhá»‹ phÃ¢n) vÃ o
   * active.nextStrikeInSeconds, cÃ³ thá»ƒ lÃ m lá»‡ch 1 lÃ´i kÃ­ch so vá»›i tháº­t.
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


    // Ngoài vòng fixed-step — TribulationDirector tự có catch-up dạng
    // đóng (spec dot-pha-loi-kiep §5.6), chia nhỏ sẽ cộng dồn sai số float.
    this.tribulationDirector.update(deltaSeconds)

  }

  private grantBattleRewardIfNeeded() {
    const battle = this.battleSystem.getBattle()

    if (battle) {
      this.battleLoot.processDefeatedEnemies(battle)
    }
  }

  /**
   * Vue layer (App.vue's tick()) gá»i má»—i tick Ä‘á»ƒ rÃºt toast phÃ¡t sinh
   * TRONG core ká»ƒ tá»« láº§n gá»i trÆ°á»›c â€” tráº£ vá» rá»“i xoÃ¡ hÃ ng Ä‘á»£i.
   */
  drainNotifications(): NotificationEvent[] {
    return this.notifications.drain()
  }
}
