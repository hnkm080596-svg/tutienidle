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
import { getAlchemySuccessBonusPercentPoints, getReactionKeepChance, collectTalentEffects } from '../talent/TalentEffects'
import { TALENT_PASSIVE_SKILLS, getTalentPassiveSkill } from '../../data/skill/TalentPassives'
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
import { EquipmentBag } from '../equipment/EquipmentBag'
import { EquipmentSystem } from '../equipment/EquipmentSystem'
import { DecomposeSystem } from '../production/DecomposeSystem'
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
import {
  AlchemySystem,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'

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
import { EquipmentOpsSystem } from './EquipmentOpsSystem'
import { GameManagerBuildingOps } from './GameManagerBuildingOps'
import { GameManagerAlchemyOps } from './GameManagerAlchemyOps'
import { GameManagerQuestOps } from './GameManagerQuestOps'
import { GameManagerSaveRestore } from './GameManagerSaveRestore'
import { HiddenBeastSystem } from './HiddenBeastSystem'
import { TribulationDirector, type ActiveTribulationState } from '../tribulation/TribulationDirector'

import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import { QuestSystem } from '../quest/QuestSystem'
import type { Quest } from '../quest/Quest'
import type { QuestProgress } from '../quest/QuestProgress'


// Re-export gi? tuong thÃ¯Â¿Â½ch import cu (useTribulation.ts import
// ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS t? GameManager).
export { TRIBULATION_COOLDOWN_SECONDS } from '../tribulation/TribulationDirector'
export type { ActiveTribulationState } from '../tribulation/TribulationDirector'


import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import type { BattleRewardSummary } from '../reward/BattleRewardSummary'

import { playerToCombatEntity, createPlayerRewardReceiver } from '../player/Player'
import { getKiemYPermanent } from '../player/KiemYSystem'
import { HERO_LANE_INDEX } from '../battle/BattleLane'
import type { PlayerData, KiemTuRoute } from '../player/Player'
import type { MainStatKey } from '../stats/StatTypes'
import { getMainStatCap } from '../stats/StatCap'
import { MAIN_STAT_KEYS } from '../stats/StatTypes'
import { BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'
import { CHAIN_SKILL_IDS } from '../../data/skill/Skills'
import type { ElementType } from '../element/ElementType'
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
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import { resolveEnemySpawnPosition } from '../battle/EnemySpawnPlacement'
import type { TurnSkillDefinition, TurnSkillSlotRole } from '../battle/turn/TurnSkillAction'
import { buildTurnSkillPresentation, type TurnSkillPresentationEntry } from '../combat/CombatSkillPresentation'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'

/**
 * GameManager lÃƒÂ  orchestrator (2026-08-24 refactor Ã¢â‚¬â€ tÃƒÂ¡ch business logic
 * trÃ¡ÂºÂ­n Ã„â€˜Ã¡ÂºÂ¥u Ã„â€˜ang diÃ¡Â»â€¦n ra sang 3 service trong cÃƒÂ¹ng thÃ†Â° mÃ¡Â»Â¥c):
 *
 * 1. KhÃ¡Â»Å¸i tÃ¡ÂºÂ¡o vÃƒÂ  giÃ¡Â»Â¯ instance cÃ¡Â»Â§a mÃ¡Â»Âi Manager/System + wire dependency
 *    cho BattleLootSystem (loot/particle/toast/battle summary),
 *    StageWaveSystem (wave MÃƒÂ n + boss summon), TribulationSystem
 *    (runtime Ã„ÂÃ¡Â»â„¢ KiÃ¡ÂºÂ¿p) Ã¢â‚¬â€ xem constructor().
 * 2. Ã„ÂiÃ¡Â»Âu phÃ¡Â»â€˜i update(deltaSeconds) mÃ¡Â»â€”i tick cho cÃƒÂ¡c system cÃƒÂ³ yÃ¡ÂºÂ¿u tÃ¡Â»â€˜
 *    thÃ¡Â»Âi gian (Buff, Skill, Battle) qua fixed-step catch-up.
 * 3. TÃ¡Â»â€¢ng hÃ¡Â»Â£p modifier tÃ¡Â»Â« nhiÃ¡Â»Âu nguÃ¡Â»â€œn (buff/technique/skill).
 * 4. GiÃ¡Â»Â¯ public API Ã¡Â»â€¢n Ã„â€˜Ã¡Â»â€¹nh cho Vue layer/tests: cÃƒÂ¡c method cÃƒÂ²n lÃ¡ÂºÂ¡i chÃ¡Â»Â§
 *    yÃ¡ÂºÂ¿u lÃƒÂ  facade delegate xuÃ¡Â»â€˜ng system tÃ†Â°Ã†Â¡ng Ã¡Â»Â©ng.
 *
 * ToÃƒÂ n bÃ¡Â»â„¢ logic thÃ¡ÂºÂ­t (Ã„â€˜iÃ¡Â»Âu kiÃ¡Â»â€¡n hÃ¡Â»Âc skill, cÃƒÂ¡ch tÃƒÂ­nh reward...) nÃ¡ÂºÂ±m
 * trong cÃƒÂ¡c System tÃ†Â°Ã†Â¡ng Ã¡Â»Â©ng.
 */

// TrÃ¡ÂºÂ¡ng thÃƒÂ¡i Tribulation (ActiveTribulation/TRIBULATION_COOLDOWN_SECONDS)
// Ã„â€˜ÃƒÂ£ chuyÃ¡Â»Æ’n sang TribulationSystem.ts Ã¢â‚¬â€ GameManager re-export Ã¡Â»Å¸ Ã„â€˜Ã¡ÂºÂ§u file.

// Uncommitted audit followup plan, mÃ¡Â»Â¥c "Fixed-step/catch-up cho combat"
// (2026-08-24) Ã¢â‚¬â€ App.vue Ã„â€˜o deltaSeconds THÃ¡ÂºÂ¬T giÃ¡Â»Â¯a 2 lÃ¡ÂºÂ§n tick() bÃ¡ÂºÂ±ng
// GameClock (xem App.vue's tick()); khi tab bÃ¡Â»â€¹ trÃƒÂ¬nh duyÃ¡Â»â€¡t throttle
// (background/minimize) hoÃ¡ÂºÂ·c mÃƒÂ¡y vÃ¡Â»Â«a resume sau suspend, deltaSeconds
// cÃ¡Â»Â§a MÃ¡Â»ËœT lÃ¡ÂºÂ§n gÃ¡Â»Âi cÃƒÂ³ thÃ¡Â»Æ’ lÃ¡Â»â€ºn bÃ¡ÂºÂ¥t thÃ†Â°Ã¡Â»Âng. battleSystem.update()/
// StageWaveSystem.update() chÃ¡Â»â€° kiÃ¡Â»Æ’m tra timer <= 0 MÃ¡Â»ËœT LÃ¡ÂºÂ¦N mÃ¡Â»â€”i lÃ¡Â»Âi gÃ¡Â»Âi
// rÃ¡Â»â€œi reset vÃ¡Â»Â mÃ¡Â»â€˜c mÃ¡Â»â€ºi (cadence skill, attackTimer, spawnCountdown) Ã¢â‚¬â€
// KHÃƒâ€NG cÃƒÂ³ vÃƒÂ²ng lÃ¡ÂºÂ·p catch-up nhÃ†Â° updateKimThe()/TribulationSystem.update(), nÃƒÂªn
// phÃ¡ÂºÂ§n nÃ¡Â»Â£ (timer ÃƒÂ¢m sÃƒÂ¢u) bÃ¡Â»â€¹ vÃ¡Â»Â©t bÃ¡Â»Â thÃ¡ÂºÂ³ng: mÃ¡Â»â„¢t khoÃ¡ÂºÂ£ng deltaSeconds lÃ¡Â»â€ºn
// chÃ¡Â»â€° tÃ¡ÂºÂ¡o ra Ã„ÂÃƒÅ¡NG 1 Ã„â€˜ÃƒÂ²n Ã„â€˜ÃƒÂ¡nh/1 lÃ¡ÂºÂ§n spawn thay vÃƒÂ¬ nhiÃ¡Â»Âu lÃ¡ÂºÂ§n Ã„â€˜ÃƒÂºng theo
// nhÃ¡Â»â€¹p thÃ¡ÂºÂ­t. Chia deltaSeconds thÃƒÂ nh cÃƒÂ¡c bÃ†Â°Ã¡Â»â€ºc cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh nhÃ¡Â»Â khi gÃ¡Â»Âi cÃƒÂ¡c
// hÃƒÂ m phÃ¡Â»Â¥ thuÃ¡Â»â„¢c timer-Ã„â€˜Ã¡ÂºÂ¿m-ngÃ†Â°Ã¡Â»Â£c-rÃ¡Â»â€œi-reset nÃƒÂ y sÃ¡Â»Â­a Ã„â€˜ÃƒÂºng gÃ¡Â»â€˜c vÃ¡ÂºÂ¥n Ã„â€˜Ã¡Â»Â mÃƒÂ 
// khÃƒÂ´ng cÃ¡ÂºÂ§n viÃ¡ÂºÂ¿t lÃ¡ÂºÂ¡i vÃƒÂ²ng lÃ¡ÂºÂ·p catch-up riÃƒÂªng cho tÃ¡Â»Â«ng timer.
const BATTLE_FIXED_STEP_SECONDS = 0.1

// GiÃ¡Â»â€ºi hÃ¡ÂºÂ¡n tÃ¡Â»â€¢ng thÃ¡Â»Âi gian Ã„â€˜Ã†Â°Ã¡Â»Â£c "Ã„â€˜uÃ¡Â»â€¢i kÃ¡Â»â€¹p" cho mÃ¡Â»â€”i lÃ¡ÂºÂ§n update() Ã¢â‚¬â€ trÃƒÂ¡nh
// hÃƒÂ ng ngÃƒÂ n bÃ†Â°Ã¡Â»â€ºc Ã„â€˜Ã¡Â»â€œng bÃ¡Â»â„¢ khoÃƒÂ¡ UI sau khi mÃƒÂ¡y ngÃ¡Â»Â§/tab bÃ¡Â»â€¹ treo rÃ¡ÂºÂ¥t lÃƒÂ¢u.
// PhÃ¡ÂºÂ§n deltaSeconds vÃ†Â°Ã¡Â»Â£t ngÃ†Â°Ã¡Â»Â¡ng nÃƒÂ y bÃ¡Â»â€¹ bÃ¡Â»Â qua cho riÃƒÂªng nhÃƒÂ¡nh combat/
// stage (coi nhÃ†Â° trÃ¡ÂºÂ­n Ã„â€˜Ã¡ÂºÂ¥u "tÃ¡ÂºÂ¡m dÃ¡Â»Â«ng" trong khoÃ¡ÂºÂ£ng Ã„â€˜ÃƒÂ³) Ã¢â‚¬â€ cÃƒÂ¡c hÃ¡Â»â€¡ thÃ¡Â»â€˜ng
// khÃƒÂ¡c (buff/cooldown/passive/formation Ã¡Â»Å¸ update() bÃƒÂªn dÃ†Â°Ã¡Â»â€ºi) vÃ¡ÂºÂ«n nhÃ¡ÂºÂ­n
// Ã„ÂÃ¡Â»Â¦ deltaSeconds thÃ¡ÂºÂ­t vÃƒÂ¬ chÃƒÂºng vÃ¡Â»â€˜n Ã„â€˜ÃƒÂ£ an toÃƒÂ n vÃ¡Â»â€ºi delta lÃ¡Â»â€ºn.
const BATTLE_MAX_CATCHUP_SECONDS = 30

// PhÃƒÂ¡p Tu skill tree redesign (2026-08-21) Ã¢â‚¬â€ "Starter Skill KHÃƒâ€NG nÃ¡ÂºÂ±m
// bÃƒÂªn ngoÃƒÂ i skill tree, nÃƒÂ³ CHÃƒÂNH LÃƒâ‚¬ root node cÃ¡Â»Â§a skill tree hÃƒÂ nh Ã„â€˜ÃƒÂ³"
// (user spec). KhÃƒÂ´ng cÃƒÂ²n learnSkill() gÃ¡Â»Âi trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y nÃ¡Â»Â¯a (Ã„â€˜ÃƒÂ³ lÃƒÂ 
// "auto-grant system riÃƒÂªng" mÃƒÂ  spec cÃ¡ÂºÂ¥m) Ã¢â‚¬â€ chooseCultivationPath() giÃ¡Â»Â
// mua node gÃ¡Â»â€˜c cÃ¡Â»Â§a HÃ¡Â»Âa (PHAP_TU_STARTER_NODE_ID, cost 0, xem
// data/progression/PhapTuNodes.ts's FIRE_LINH_NGO) qua Ã„ÂÃƒÅ¡NG con Ã„â€˜Ã†Â°Ã¡Â»Âng
// purchaseNode() dÃƒÂ¹ng chung vÃ¡Â»â€ºi 4 hÃƒÂ nh cÃƒÂ²n lÃ¡ÂºÂ¡i (ThÃ¡Â»Â§y/MÃ¡Â»â„¢c/ThÃ¡Â»â€¢/Kim tÃ¡Â»â€˜n 2
// Skill Point, ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i tÃ¡Â»Â± mua node gÃ¡Â»â€˜c cÃ¡Â»Â§a hÃƒÂ nh Ã„â€˜ÃƒÂ³). ChÃ¡Â»â€° HÃ¡Â»Âa Ã„â€˜Ã†Â°Ã¡Â»Â£c
// tÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng mua sÃ¡ÂºÂµn (cost 0 = luÃƒÂ´n Ã„â€˜Ã¡Â»Â§ Ã„â€˜iÃ¡Â»Æ’m); phÃ¡ÂºÂ§n "trang bÃ¡Â»â€¹ vÃƒÂ o slot 0"
// vÃ¡ÂºÂ«n giÃ¡Â»Â¯ riÃƒÂªng (equip khÃƒÂ¡c hÃ¡Â»Âc, xem SkillSystem.ts) vÃƒÂ¬ Node Tree
// khÃƒÂ´ng mÃƒÂ´ tÃ¡ÂºÂ£ khÃƒÂ¡i niÃ¡Â»â€¡m loadout slot.
const PHAP_TU_STARTER_NODE_ID = 'hoa_linh_ngo'
const PHAP_TU_STARTER_SKILL_ID = 'hoa_cau_thuat'

export class GameManager {
  readonly eventBus = new EventBus()

  readonly combatSystem = new CombatSystem(this.eventBus)

  // ThiÃƒÂªn phÃƒÂº BÃ¡ÂºÂ¥t TÃ¡Â»Â­ ThÃ¡Â»Æ’ (talent-direction-choice-plan Ã‚Â§6) Ã¢â‚¬â€ guard giÃ¡Â»Â¯ lÃ†Â°Ã¡Â»Â£t
  // sÃ¡Â»â€˜ng sÃƒÂ³t battle-scoped; combatSystem.killIfDead() lÃƒÂ  Ã„â€˜iÃ¡Â»Æ’m tiÃƒÂªu thÃ¡Â»Â¥.
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
    // Talent v4 (spec 2026-09-03 Ã¯Â¿Â½3.3 E2) Ã¯Â¿Â½ buffApplier: apply buff
    // "bÃ¯Â¿Â½ng n?" c?a passiveConvertsTo lÃ¯Â¿Â½n PLAYER trong tr?n hi?n t?i
    // (pool c?a player, source = player; ngoÃ¯Â¿Â½i tr?n thÃ¯Â¿Â½ b? qua Ã¯Â¿Â½
    // passive combat ch? ch?y trong tr?n).
    (buffId) => {
      const battle = this.battleSystem.getBattle()
      const definition = this.buffRegistry.get(buffId)

      if (!battle || !definition) {
        return
      }

      const buffs = new BuffSystem(battle.playerBuffs)
      buffs.apply(definition, battle.player, battle.player, this.buffRegistry)
    },
    // hpReader Ã¯Â¿Â½ HP ratio c?a player entity trong tr?n; ngoÃ¯Â¿Â½i tr?n
    // undefined (passiveCondition coi nhu thÃ¯Â¿Â½ng qua).
    () => {
      const battle = this.battleSystem.getBattle()

      if (!battle || battle.player.maxHp <= 0) {
        return undefined
      }

      return battle.player.currentHp / battle.player.maxHp
    },
  )

  // PhÃƒÂ¡p Tu Redesign (magicpath) Ã¢â‚¬â€ Node Tree, hÃ¡ÂºÂ¡ tÃ¡ÂºÂ§ng CHUNG cho mÃ¡Â»Âi
  // path, xem core/progression/.
  readonly nodeRegistry = new NodeRegistry()

  registerProgressionNodes(nodes: ProgressionNode[]) {
    for (const node of nodes) {
      if (!this.nodeRegistry.has(node.id)) {
        this.nodeRegistry.register(node)
      }
    }
  }

  /**
   * Talent v4 (spec 2026-09-03 Ã¯Â¿Â½4.1, plan M1 Task 4) Ã¯Â¿Â½ grant/revoke
   * hidden passive skill c?a talent combat dang ch?n vÃ¯Â¿Â½o SkillManager.
   * Idempotent: revoke m?i talent passive cu tru?c khi grant (d?i
   * talent qua save edit khÃ¯Â¿Â½ng nhÃ¯Â¿Â½n dÃ¯Â¿Â½i, khÃ¯Â¿Â½ng leak gi?a player).
   * G?i sau setActivePlayer/restore + sau khi App.vue ghi
   * selectedTalentIds lÃ¯Â¿Â½c t?o nhÃ¯Â¿Â½n v?t.
   */
  syncTalentCombatPassive(player: PlayerData) {
    const allTalentPassiveIds = TALENT_PASSIVE_SKILLS.map((skill) => skill.id)

    // Revoke m?i talent passive hi?n cÃ¯Â¿Â½ (dÃ¯Â¿Â½ dÃ¯Â¿Â½ng talent Ã¯Â¿Â½ grant l?i
    // ngay sau, d?m b?o idempotent + khÃ¯Â¿Â½ng k?t passive cu khi d?i).
    for (const passiveId of allTalentPassiveIds) {
      if (this.skillManager.get(passiveId)) {
        this.skillManager.remove(passiveId)
      }
    }

    // Grant theo talent Ã¯Â¿Â½?U TIÃ¯Â¿Â½N (collectTalentEffects si?t id d?u Ã¯Â¿Â½
    // spec Ã¯Â¿Â½3.2): m?i talent combat khai 1-2 combat_passive effect.
    for (const effect of collectTalentEffects(player.selectedTalentIds)) {
      if (effect.kind === 'combat_passive') {
        const template = getTalentPassiveSkill(effect.passiveSkillId)

        if (template) {
          // Copy shallow Ã¯Â¿Â½ passiveModifiers stacks lÃ¯Â¿Â½ state runtime
          // per-battle, khÃ¯Â¿Â½ng chia s? object v?i template data.
          this.skillManager.add({ ...template, passiveModifiers: template.passiveModifiers?.map((modifier) => ({ ...modifier })) })
        }
      }
    }
  }

  // Khai bÃƒÂ¡o sau skillManager/skillSystem/skillEffectSystem/
  // buffRegistry vÃƒÂ¬ field class khÃ¡Â»Å¸i tÃ¡ÂºÂ¡o theo thÃ¡Â»Â© tÃ¡Â»Â± khai bÃƒÂ¡o Ã¢â‚¬â€
  // BattleSystem cÃ¡ÂºÂ§n cÃƒÂ¡c field nÃƒÂ y Ã„â€˜ÃƒÂ£ cÃƒÂ³ giÃƒÂ¡ trÃ¡Â»â€¹ (basic skill
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
    // restored 10Ãƒâ€”16 battle recomputes effective stats each tick.
    () => (this.activePlayer ? this.getActiveRuntimeModifiers(this.activePlayer) : []),

    // Combat AI strategy (plan Ã‚Â§7/Ã‚Â§10) Ã¢â‚¬â€ PlayerData lÃƒÂ  authority; Ã„â€˜Ã¡Â»Âc
    // LIVE Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã¡Â»â€¢i strategy giÃ¡Â»Â¯a trÃ¡ÂºÂ­n cÃƒÂ³ hiÃ¡Â»â€¡u lÃ¡Â»Â±c ngay trong tick kÃ¡ÂºÂ¿.
    () => this.activePlayer?.combatAiStrategy ?? DEFAULT_COMBAT_AI_STRATEGY,

    // ThiÃƒÂªn phÃƒÂº PhÃ¡ÂºÂ£n PhÃƒÂ¡c (talent-direction-choice-plan Ã‚Â§6) Ã¢â‚¬â€ xÃƒÂ¡c suÃ¡ÂºÂ¥t giÃ¡Â»Â¯
    // ailment khi kÃƒÂ­ch Reaction, Ã„â€˜Ã¡Â»Âc LIVE tÃ¡Â»Â« activePlayer.
    () => getReactionKeepChance(this.activePlayer?.selectedTalentIds ?? []),

    // Final review fix (Important #6) Ã¢â‚¬â€ nguÃ¡Â»â€œn sÃ¡Â»Â± thÃ¡ÂºÂ­t DUY NHÃ¡ÂºÂ¤T cho viÃ¡Â»â€¡c
    // kÃƒÂ­ch hoÃ¡ÂºÂ¡t channel BÃ¡ÂºÂ¡t KiÃ¡ÂºÂ¿m, khÃ¡Â»â€ºp Ã„â€˜ÃƒÂºng Ã„â€˜iÃ¡Â»Âu kiÃ¡Â»â€¡n channel UI Ã„â€˜ang
    // Ã„â€˜Ã¡Â»Âc (player.kiemTuRoute === 'bat_kiem').
    () => this.activePlayer?.kiemTuRoute,

    // Ki?m Ã¯Â¿Â½ vinh vi?n (spec 2026-08-29-kiem-the-kiem-y m?c 3) Ã¯Â¿Â½ closure
    // Ã¯Â¿Â½Ã¯Â¿Â½ khai bÃ¯Â¿Â½o trong BattleSystem nhung chua t?ng du?c inject ? dÃ¯Â¿Â½y
    // (profile kiem-tu Ã¯Â¿Â½4.7): thi?u nÃ¯Â¿Â½ ? Ki?m Ã¯Â¿Â½ t?m d?u tr?n = 0, nerf
    // B?t Ki?m m?c k?t 0.6, on-hit khÃ¯Â¿Â½ng roll. Ã¯Â¿Â½?c LIVE t? bossKillCount.
    () => (this.activePlayer ? getKiemYPermanent(this.activePlayer.bossKillCount) : 0),

    // H?p th? Huy Ki?m (spec m?c 3.4) Ã¯Â¿Â½ t?ng cast c?a tram, d?c LIVE t?
    // skillManager (flat bonus floor(casts/10) vÃ¯Â¿Â½o B?t Ki?m tick).
    () => this.skillManager.get('tram')?.totalExperience ?? 0,

    // On-hit Ki?m Tr?n (spec m?c 4) Ã¯Â¿Â½ c?p node on-hit dÃ¯Â¿Â½ mua, l?c qua
    // nodeRegistry (ch? node cÃ¯Â¿Â½ effect.onHitEffect).
    () => this.getOnHitNodeLevelsSnapshot(),

    // PhÃ¯Â¿Â½p Tu Thu?n H? (Task 12, 2026-09-03) Ã¯Â¿Â½ hÃ¯Â¿Â½nh Thu?n dang ch?n, d?c
    // LIVE t? node lap_dao_thuan_<el> dÃ¯Â¿Â½ mua (PlayerData lÃ¯Â¿Â½ authority).
    () => this.getPhapTuThuanElement(),
  )

  // =========================
  // TURN-BASED COMBAT (Slice 6 cutover) Ã¢â‚¬â€ engine thÃ¡ÂºÂ­t Ã„â€˜iÃ¡Â»Âu khiÃ¡Â»Æ’n combat.
  // BattleSystem.ts vÃ¡ÂºÂ«n giÃ¡Â»Â¯ field tÃ¡Â»â€ºi khi mÃ¡Â»Âi consumer nÃ¡Â»â„¢i bÃ¡Â»â„¢ flip xong
  // (legacy battle state dÃƒÂ¹ng bÃ¡Â»Å¸i passiveSystem/tribulation side).
  // =========================
  private turnBattleSystem = new TurnBattleSystem(this.combatSystem)

  private turnBattle: TurnBattle | null = null

  /** Template enemy gÃ¡ÂºÂ§n nhÃ¡ÂºÂ¥t Ã„â€˜ÃƒÂ£ spawn (fallback cho spawnEnemy factory). */
  private lastStageEnemyTemplate: Enemy | null = null

  /**
   * Snapshot c?p cÃ¯Â¿Â½c node on-hit Ki?m Tr?n dÃ¯Â¿Â½ mua (d?c t?
   * PlayerData.nodeLevels qua registry Ã¯Â¿Â½ node lÃ¯Â¿Â½ ngu?n s? th?t c?a
   * `effect.onHitEffect`). Tr? `{}` khi chua cÃ¯Â¿Â½ player/chua mua node.
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

  /**
   * PhÃ¯Â¿Â½p Tu Thu?n H? (Task 12, 2026-09-03) Ã¯Â¿Â½ hÃ¯Â¿Â½nh Thu?n Ã¯Â¿Â½ANG CH?N c?a
   * player ho?t d?ng: node `lap_dao_thuan_<el>` (keystone mutex Ã¯Â¿Â½ data
   * d?m b?o t?i da 1 hÃ¯Â¿Â½nh) dÃ¯Â¿Â½ mua level = 1. undefined = chua L?p Ã¯Â¿Â½?o
   * Thu?n / khÃ¯Â¿Â½ng ph?i PhÃ¯Â¿Â½p Tu ? chain khÃ¯Â¿Â½ng gate, ult khÃ¯Â¿Â½ng n?.
   */
  getPhapTuThuanElement(): ElementType | undefined {
    if (!this.activePlayer) {
      return undefined
    }

    for (const element of Object.keys(CHAIN_SKILL_IDS) as ElementType[]) {
      const level = this.activePlayer.nodeLevels[`lap_dao_thuan_${element}`]

      if (level !== undefined && level > 0) {
        return element
      }
    }

    return undefined
  }

  readonly techniqueManager = new TechniqueManager()
  readonly techniqueSystem = new TechniqueSystem(this.techniqueManager)

  readonly materialRegistry = new MaterialRegistry()
  readonly materialBag = new MaterialBag()

  readonly equipmentRegistry = new EquipmentRegistry()
  readonly equipmentBag = new EquipmentBag()
  readonly equipmentSystem = new EquipmentSystem(createDefaultEquipmentOperationCostCatalog())

  // Task 14 (rework P4) Ã¯Â¿Â½ Tab PhÃ¯Â¿Â½n Gi?i: khoÃ¯Â¿Â½ng ? Luy?n KhÃ¯Â¿Â½ Tinh Hoa.
  readonly decomposeSystem = new DecomposeSystem(this.materialBag, { autoWorkerCapacity: 0 })

  // Core Loop Foundation checklist (Phase 3, MÃ¡Â»Â¥c AFFIX) Ã¢â‚¬â€ thay thÃ¡ÂºÂ¿
  // hoÃƒÂ n toÃƒÂ n substatPool cÃ…Â©.
  readonly affixRegistry = new AffixRegistry()

  // MASTER SPEC MÃ¡Â»Â¥c XVI (Phase 9) Ã¢â‚¬â€ CÃ†Â°Ã¡Â»Âng HÃƒÂ³a sÃ¡Â»â€˜ng Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y (theo SLOT,
  // 6 slot cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh), tÃƒÂ¡ch khÃ¡Â»Âi EquipmentInstance.
  readonly equipmentSlotManager = new EquipmentSlotManager()

  readonly pillRegistry = new PillRegistry()
  readonly pillBag = new PillBag()
  readonly pillSystem = new PillSystem()

  // PhÃƒÂ¹/TrÃ¡ÂºÂ­n legacy (2026-08-25, plan Ã‚Â§10.1.4) Ã¢â‚¬â€ registry giÃ¡Â»Â¯ lÃ¡ÂºÂ¡i CHÃ¡Â»Ë†
  // Ã„ÂÃ¡Â»Å’C nhÃ†Â° tombstone Ã„â€˜Ã¡Â»Æ’ save cÃ…Â© khÃƒÂ´ng crash vÃƒÂ¬ registry lookup; KHÃƒâ€NG
  // cÃƒÂ²n bag, KHÃƒâ€NG Ã„â€˜Ã„Æ’ng kÃƒÂ½ content mÃ¡Â»â€ºi dÃƒÂ¹ng Ã„â€˜Ã†Â°Ã¡Â»Â£c.
  readonly talismanRegistry = new TalismanRegistry()
  readonly formationRegistry = new FormationRegistry()

  readonly itemRegistry = new ItemRegistry(
    this.equipmentRegistry,
    this.pillRegistry,
    this.talismanRegistry,
    this.materialRegistry,
  )

  // =========================
  // Production (2026-08-25, resource-professions-rework plan Ã‚Â§4) Ã¢â‚¬â€
  // thay ExplorationSystem: ba nguÃ¡Â»â€œn LÃƒÂ¢m/QuÃƒÂ¡ng/Ã„ÂÃ¡Â»â„¢ng ThiÃƒÂªn cÃ¡Â»Â§a Thanh VÃƒÂ¢n
  // dÃƒÂ¹ng chung engine cycle snapshot + settle idempotent.
  // =========================
  readonly productionSystem = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })

  // Ã„Âan PhÃƒÂ²ng (plan Ã‚Â§8) Ã¢â‚¬â€ job luyÃ¡Â»â€¡n Ã„â€˜an vÃ¡Â»â€ºi reserve atomic.
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

  // Session trÃ¡ÂºÂ­n Ã„â€˜ang diÃ¡Â»â€¦n ra (receiver nhÃ¡ÂºÂ­n thÃ†Â°Ã¡Â»Å¸ng + PlayerData Ã„â€˜Ã¡Â»Æ’ roll
  // loot) Ã„â€˜ÃƒÂ£ chuyÃ¡Â»Æ’n vÃƒÂ o BattleLootSystem Ã¢â‚¬â€ xem constructor().

  // Beta Phase 4 (Notification/UX) Ã¢â‚¬â€ hÃƒÂ ng Ã„â€˜Ã¡Â»Â£i toast phÃƒÂ¡t sinh TRONG
  // core (loot tÃ¡Â»Â« BattleLootSystem, upgrade skill tÃ¡Â»Â« callback Ã¡Â»Å¸ trÃƒÂªn).
  private readonly notifications = new NotificationQueue()

  // =========================
  // RUNTIME SERVICES (2026-08-24 tÃƒÂ¡ch khÃ¡Â»Âi thÃƒÂ¢n class nÃƒÂ y)
  // =========================

  // Ba service du?i dÃ¯Â¿Â½y s? h?u business logic tr?n d?u dang di?n ra:
  // - BattleLootSystem: loot/particle/toast/battle summary khi quÃ¯Â¿Â½i ch?t.
  // - StageWaveSystem: vÃ¯Â¿Â½ng d?i wave c?a MÃ¯Â¿Â½n + boss summon.
  // - TribulationDirector: runtime chuong ki?p m?i (tÃ¯Â¿Â½m ma + tank lÃ¯Â¿Â½i,
  //   spec dot-pha-loi-kiep Ã¯Â¿Â½5) + cooldown.
  // Kh?i t?o trong constructor (KHÃ¯Â¿Â½NG ph?i field initializer) vÃ¯Â¿Â½ c?n
  // tham chi?u t?i cÃ¯Â¿Â½c field khai bÃ¯Â¿Â½o SAU chÃ¯Â¿Â½ng ? trÃ¯Â¿Â½n (bags/registries/
  // zoneRegistry/template registries) Ã¯Â¿Â½ field initializer ch?y theo th?
  // t? khai bÃ¯Â¿Â½o nÃ¯Â¿Â½n khÃ¯Â¿Â½ng th?y du?c; ctor body ch?y sau cÃ¯Â¿Â½ng, an toÃ¯Â¿Â½n.

  private readonly battleLoot: BattleLootSystem
  private readonly stageWaves: StageWaveSystem
  private readonly tribulationDirector: TribulationDirector
  private readonly equipmentOps: EquipmentOpsSystem
  private readonly buildingOps: GameManagerBuildingOps
  private readonly alchemyOps: GameManagerAlchemyOps
  private readonly questOps: GameManagerQuestOps
  private readonly saveRestore: GameManagerSaveRestore

  // QuÃ¯Â¿Â½i ?n (spec dot-pha-loi-kiep Ã¯Â¿Â½4.1c) Ã¯Â¿Â½ c?a s? 1000 kill Luy?n KhÃ¯Â¿Â½.
  readonly hiddenBeastSystem: HiddenBeastSystem

  constructor() {
    // KiÃ¡ÂºÂ¿m Tu (2026-08-28) Ã¢â‚¬â€ mirror player.skillCastCounts/skillLevels
    // mÃ¡Â»â€”i lÃ¡ÂºÂ§n cast, phÃ¡Â»Â¥c vÃ¡Â»Â¥ NodeSystem prerequisite `skillCastCount`
    // (NodeSystem chÃ¡Â»â€° nhÃ¡ÂºÂ­n PlayerData, khÃƒÂ´ng cÃƒÂ³ SkillManager). Ghi vÃƒÂ o
    // activePlayer (Ã„â€˜Ã„Æ’ng kÃƒÂ½ qua setActivePlayer(), xem field bÃƒÂªn dÃ†Â°Ã¡Â»â€ºi)
    // Ã¢â‚¬â€ no-op an toÃƒÂ n nÃ¡ÂºÂ¿u chÃ†Â°a cÃƒÂ³ player active (vd unit test dÃ¡Â»Â±ng
    // GameManager trÃ¡ÂºÂ§n).
    this.skillSystem.setCastCountSink((skillId, totalExperience, level) => {
      if (!this.activePlayer) return

      this.activePlayer.skillCastCounts ??= {}
      this.activePlayer.skillCastCounts[skillId] = totalExperience

      this.activePlayer.skillLevels ??= {}
      this.activePlayer.skillLevels[skillId] = level
    })

    // QuÃ¯Â¿Â½i ?n (spec dot-pha-loi-kiep Ã¯Â¿Â½4.1c) Ã¯Â¿Â½ tra template qua registry
    // chung (registerEnemyTemplates dÃ¯Â¿Â½ dang kÃ¯Â¿Â½ Huy?t MÃ¯Â¿Â½ng qua ENEMIES).
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
        this.notifyQuestMaterialGained(materialId, amount),
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
        this.notifyQuestMaterialGained(materialId, amount),
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
      buildPlayerRewardReceiver: (player) => this.buildPlayerRewardReceiver(player),
    })

    this.saveRestore = new GameManagerSaveRestore({
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
      buildingManager: this.buildingManager,
      questManager: this.questManager,
      productionSystem: this.productionSystem,
      alchemySystem: this.alchemySystem,
      notifications: this.notifications,
      getActivePlayer: () => this.activePlayer,
      refreshAutoWorkerCapacity: (player, instance) =>
        this.refreshAutoWorkerCapacity(player, instance),
      getWorkerAssignments: () => this.getWorkerAssignments(),
    })
  }

  /**
   * Skill runtime stats + node-derived skillModifiers (plan Ã‚Â§6.8) Ã¢â‚¬â€
   * thay Ã„â€˜Ã†Â°Ã¡Â»Âng mutate Skill instance lÃƒÂºc purchase: cÃ¡Â»â„¢ng flat/perLevel
   * suy ra tÃ¡Â»Â« (registry, nodeLevels) lÃƒÂªn trÃƒÂªn tÃ¡Â»â€¢ng hÃ¡Â»Â£p cÃ¡Â»Â§a SkillSystem.
   * Public cho UI/test; combat snapshot Ã„â€˜i qua cÃƒÂ¹ng Ã„â€˜Ã†Â°Ã¡Â»Âng nÃƒÂ y.
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
  // NÃ¡ÂºÂ¡p dÃ¡Â»Â¯ liÃ¡Â»â€¡u tÃ„Â©nh (tÃ¡Â»Â« /data) vÃƒÂ o cÃƒÂ¡c Manager. GÃ¡Â»Âi 1 lÃ¡ÂºÂ§n lÃƒÂºc
  // khÃ¡Â»Å¸i tÃ¡ÂºÂ¡o game. TÃƒÂ¡ch riÃƒÂªng khÃ¡Â»Âi constructor Ã„â€˜Ã¡Â»Æ’ cÃƒÂ³ thÃ¡Â»Æ’ gÃ¡Â»Âi lÃ¡ÂºÂ¡i
  // trong test hoÃ¡ÂºÂ·c khi cÃ¡ÂºÂ§n nÃ¡ÂºÂ¡p thÃƒÂªm data theo DLC/patch sau nÃƒÂ y.

  registerMaterials(materials: Material[]) {
    // Boot validator (plan Ã‚Â§4.1/Ã‚Â§10 Phase 1): lÃ¡Â»â€”i authoring dÃ¡Â»Â¯ liÃ¡Â»â€¡u nghÃ¡Â»Â
    // fail NGAY khi Ã„â€˜Ã„Æ’ng kÃƒÂ½ Ã¢â‚¬â€ khÃƒÂ´ng ÃƒÂ¢m thÃ¡ÂºÂ§m tÃ¡ÂºÂ¡o kinh tÃ¡ÂºÂ¿ hÃ¡Â»Âng. ChÃ¡Â»â€° validate
    // material CÃƒâ€œ meta nghÃ¡Â»Â (legacy material khÃƒÂ´ng Ã„â€˜Ã¡Â»Â¥ng); kiÃ¡Â»Æ’m tra
    // PER-ENTRY (id convention + realm scope) Ã¢â‚¬â€ completeness toÃƒÂ n catalog
    // (Ã„â€˜Ã¡Â»Â§ 3 rarity/cell) enforce Ã¡Â»Å¸ ProfessionDataIntegrity.test trÃƒÂªn
    // TOÃƒâ‚¬N BÃ¡Â»Ëœ mÃ¡ÂºÂ£ng materials (registerMaterials cÃƒÂ³ thÃ¡Â»Æ’ Ã„â€˜Ã†Â°Ã¡Â»Â£c gÃ¡Â»Âi tÃ¡Â»Â«ng
    // phÃ¡ÂºÂ§n trong test).
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

  /** Ã„ÂÃ„Æ’ng kÃƒÂ½ Ã„â€˜an phÃ†Â°Ã†Â¡ng (plan Ã‚Â§8) Ã¢â‚¬â€ validate mapping thÃ¡ÂºÂ£o duy nhÃ¡ÂºÂ¥t. */
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
        throw new Error(`Alchemy recipe ${recipe.id}: herb variants trÃ¯Â¿Â½ng l?p`)
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
    // Tombstone-only (plan Ã‚Â§10.1.4).
    for (const formation of formations) {
      if (!this.formationRegistry.has(formation.id)) {
        this.formationRegistry.register(formation)
      }
    }
  }

  registerTalismans(talismans: Talisman[]) {
    // Tombstone-only (plan Ã‚Â§10.1.4) Ã¢â‚¬â€ Ã„â€˜Ã„Æ’ng kÃƒÂ½ Ã„â€˜Ã¡Â»Æ’ save cÃ…Â© load khÃƒÂ´ng
    // crash, KHÃƒâ€NG tÃ¡ÂºÂ¡o nguÃ¡Â»â€œn mÃ¡Â»â€ºi.
    for (const talisman of talismans) {
      if (!this.talismanRegistry.has(talisman.id)) {
        this.talismanRegistry.register(talisman)
      }
    }
  }

  // Skill/Technique khÃƒÂ´ng "register" sÃ¡ÂºÂµn cÃƒÂ³ toÃƒÂ n bÃ¡Â»â„¢ danh sÃƒÂ¡ch gÃ¡Â»â€˜c
  // vÃƒÂ o manager Ã¢â‚¬â€ chÃƒÂºng chÃ¡Â»â€° Ã„â€˜Ã†Â°Ã¡Â»Â£c add khi ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i thÃ¡Â»Â±c sÃ¡Â»Â± hÃ¡Â»Âc
  // (learn), Ã„â€˜ÃƒÂºng nhÃ†Â° SkillSystem.learn()/TechniqueSystem.learn()
  // Ã„â€˜ÃƒÂ£ thiÃ¡ÂºÂ¿t kÃ¡ÂºÂ¿. GameManager chÃ¡Â»â€° cung cÃ¡ÂºÂ¥p nÃ†Â¡i tra cÃ¡Â»Â©u template.
  private skillTemplates = new TemplateRegistry<Skill>()
  private techniqueTemplates = new TemplateRegistry<Technique>()

  // Enemy template tra theo id (dÃƒÂ¹ng bÃ¡Â»Å¸i StageSystem khi chÃ¡Â»Ân quÃƒÂ¡i
  // kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p Ã„â€˜Ã¡Â»Æ’ spawn) Ã¢â‚¬â€ cÃƒÂ¹ng pattern skillTemplates/techniqueTemplates,
  // KHÃƒÂC EnemyManager (chÃ¡Â»â€° chÃ¡Â»Â©a instance Ã„â€˜ÃƒÂ£ spawn, cÃƒÂ³ id riÃƒÂªng tÃ¡Â»Â«ng
  // con Ã¢â‚¬â€ xem EnemySystem.spawn()).
  private enemyTemplates = new TemplateRegistry<Enemy>()

  // Stage template tra theo id Ã¢â‚¬â€ cÃƒÂ¹ng pattern enemyTemplates.
  private stageTemplates = new TemplateRegistry<Stage>()

  // ThÃƒÂ¡m HiÃ¡Â»Æ’m rework Ã¢â‚¬â€ Ã„ÂÃ¡Â»â€¹a GiÃ¡Â»â€ºi (nhÃƒÂ³m nhiÃ¡Â»Âu Stage/MÃƒÂ n), xem
  // core/stage/Zone.ts. Registry thÃ¡ÂºÂ­t (khÃƒÂ´ng phÃ¡ÂºÂ£i Map trÃ¡ÂºÂ§n nhÃ†Â°
  // stageTemplates) vÃƒÂ¬ StageSelectPanel.vue cÃ¡ÂºÂ§n getAll()/has() trÃ¡Â»Â±c
  // tiÃ¡ÂºÂ¿p, khÃƒÂ´ng chÃ¡Â»â€° tra theo id Ã„â€˜Ã†Â¡n lÃ¡ÂºÂ».
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
   * TÃ¡Â»Â± Ã„ÂÃ¡Â»â„¢ng ThÃƒÂ¡m HiÃ¡Â»Æ’m (mode 'auto', xem stores/ui.ts) Ã¢â‚¬â€ MÃƒÂ n kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p
   * trong CÃƒâ„¢NG Ã„ÂÃ¡Â»â€¹a GiÃ¡Â»â€ºi vÃ¡Â»â€ºi `currentStageId`, theo Ã„â€˜ÃƒÂºng thÃ¡Â»Â© tÃ¡Â»Â± khai
   * trong `Zone.stageIds`. TrÃ¡ÂºÂ£ vÃ¡Â»Â null nÃ¡ÂºÂ¿u Ã„â€˜ÃƒÂ£ Ã¡Â»Å¸ MÃƒÂ n cuÃ¡Â»â€˜i hoÃ¡ÂºÂ·c
   * currentStageId khÃƒÂ´ng thuÃ¡Â»â„¢c zone nÃƒÂ y Ã¢â‚¬â€ caller (App.vue's
   * fightStage()) tÃ¡Â»Â± fallback lÃ¡ÂºÂ·p lÃ¡ÂºÂ¡i MÃƒÂ n hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i khi null (graceful,
   * khÃƒÂ´ng cÃ¡ÂºÂ§n biÃ¡ÂºÂ¿t trÃ†Â°Ã¡Â»â€ºc zone cÃƒÂ³ bao nhiÃƒÂªu MÃƒÂ n).
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
      // Stage Ã„â€˜Ã¡Â»â„¢c lÃ¡ÂºÂ­p (Ã„ÂÃ¡Â»â„¢ KiÃ¡ÂºÂ¿p/test/debug) khÃƒÂ´ng thuÃ¡Â»â„¢c tuyÃ¡ÂºÂ¿n thÃƒÂ¡m hiÃ¡Â»Æ’m.
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
   * PhÃƒÂ¡p Tu Redesign (magicpath) Ã¢â‚¬â€ mua 1 ProgressionNode (LÃ„Â¨NH NGÃ¡Â»Ëœ,
   * 0Ã¢â€ â€™1). GÃ¡Â»Âi `purchaseNode()` thuÃ¡ÂºÂ§n (core/progression/NodeSystem.ts)
   * trÃ†Â°Ã¡Â»â€ºc Ã¢â‚¬â€ hÃƒÂ m Ã„â€˜ÃƒÂ³ tÃ¡Â»Â± xÃ¡Â»Â­ lÃƒÂ½ mÃ¡Â»Âi thÃ¡Â»Â© khÃƒÂ´ng cÃ¡ÂºÂ§n registry. ChÃ¡Â»â€° cÃƒÂ²n
   * `unlocksSkillIds` cÃ¡ÂºÂ§n learnSkill() (cÃ¡ÂºÂ§n skillTemplates, GameManager
   * mÃ¡Â»â€ºi cÃƒÂ³). KHÃƒâ€NG tÃ¡Â»Â± equip skill vÃ¡Â»Â«a unlock.
   *
   * Ã‚Â§6.8 Ã¢â‚¬â€ KHÃƒâ€NG cÃƒÂ²n mutate Skill instance / push player.modifiers lÃƒÂºc
   * mua: mÃ¡Â»Âi hiÃ¡Â»â€¡u lÃ¡Â»Â±c suy ra tÃ¡Â»Â« (registry, nodeLevels) qua aggregator
   * (getAggregatedModifiers + buildSkillRuntimeStats), recompute luÃƒÂ´n
   * cho cÃƒÂ¹ng kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ xÃƒÂ¡c Ã„â€˜Ã¡Â»â€¹nh.
   */
  purchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.nodeRegistry.has(nodeId)) {
      return false
    }

    const node = this.nodeRegistry.get(nodeId)

    if (!purchaseNodeSystem(player, node)) {
      return false
    }

    // Effect mÃ¡Â»Å¸ khoÃƒÂ¡ skill chÃ¡Â»â€° chÃ¡ÂºÂ¡y Ã¡Â»Å¸ chuyÃ¡Â»Æ’n tiÃ¡ÂºÂ¿p 0 Ã¢â€ â€™ 1 Ã¢â‚¬â€
    // purchaseNodeSystem chÃ¡Â»â€° trÃ¡ÂºÂ£ true Ã„â€˜ÃƒÂºng Ã¡Â»Å¸ chuyÃ¡Â»Æ’n tiÃ¡ÂºÂ¿p nÃƒÂ y.
    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId)

      // Ki?m Th? / Ki?m Ã¯Â¿Â½ (spec 2026-08-29 m?c 5.1) Ã¯Â¿Â½ ki?m tr?n ti?n
      // hÃ¯Â¿Â½a: m?i route Ã¯Â¿Â½Ã¯Â¿Â½NG 1 active skill ? slot 0, keystone m?i t?
      // THAY TH? tr?n cu (equipToSlot t? d?i occupant cu). KHÃ¯Â¿Â½NG cÃ¯Â¿Â½n
      // slot riÃ¯Â¿Â½ng KIEM_TRAN_SLOT_INDEX.
      if (skillId.startsWith('kiem_tran_')) {
        this.skillSystem.equipToSlot(skillId, 0)
      }
    }

    // PhÃ¯Â¿Â½p Tu Thu?n H? (E-8, 2026-09-03) Ã¯Â¿Â½ node bi?n th?: mua node lÃ¯Â¿Â½ CH?N
    // specialization c?a skill qua SkillSystem (cÃ¯Â¿Â½ng du?ng
    // selectSkillSpecialization c?a UI). Skill chua h?c / spec khÃ¯Â¿Â½ng t?n
    // t?i ? selectSpecialization tr? false, KHÃ¯Â¿Â½NG rollback purchase (data
    // Task 8 t? d?m b?o prereq unlocksSkillIds ch?y tru?c trong vÃ¯Â¿Â½ng l?p
    // trÃ¯Â¿Â½n).
    const selectsSpec = node.effect.selectsSpecialization

    if (selectsSpec) {
      this.skillSystem.selectSpecialization(selectsSpec.skillId, selectsSpec.specializationId)
    }

    return true
  }

  /** CÃ¡ÂºÂ¥p reward Ã„â€˜Ã¡ÂºÂ¡i cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi theo cultivation path tÃ¡Â»Â« data kit. */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId, {
      getEquippedTechnique: () => this.techniqueManager.getEquipped(),
      getTechnique: techniqueId => this.techniqueManager.get(techniqueId),
      learnTechnique: techniqueId => this.learnTechnique(techniqueId),
      equipTechnique: techniqueId => this.equipTechnique(techniqueId),
    })
  }

  /**
   * NÃƒÂ¢ng node Ã„â€˜ÃƒÂ£ lÃ„Â©nh ngÃ¡Â»â„¢ lÃƒÂªn +1 cÃ¡ÂºÂ¥p bÃ¡ÂºÂ±ng CÃ¡ÂºÂ£m NgÃ¡Â»â„¢ (Ã‚Â§6.2) Ã¢â‚¬â€ cost theo
   * data node; khÃƒÂ´ng vÃ†Â°Ã¡Â»Â£t maxLevel; thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i khÃƒÂ´ng mutate gÃƒÂ¬.
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

  /** Cost CÃ¡ÂºÂ£m NgÃ¡Â»â„¢ cÃ¡Â»Â§a lÃ¡ÂºÂ§n mua/nÃƒÂ¢ng KÃ¡ÂºÂ¾ TIÃ¡ÂºÂ¾P Ã¢â‚¬â€ undefined khi Ã„â€˜ÃƒÂ£ max. */
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
   * Reset development mÃ¡Â»â„¢t nhÃƒÂ¡nh (Ã‚Â§6.10) Ã¢â‚¬â€ hoÃƒÂ n Ã„â€˜ÃƒÂºng tÃ¡Â»â€¢ng CÃ¡ÂºÂ£m NgÃ¡Â»â„¢ Ã„â€˜ÃƒÂ£
   * tiÃƒÂªu (suy tÃ¡Â»Â« level/cost data), cascade gÃ¡Â»Â¡ node con mÃ¡Â»â€œ cÃƒÂ´i; modifier
   * tÃ¡Â»Â± cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t qua aggregator (khÃƒÂ´ng trÃ¡Â»Â« ngÃ†Â°Ã¡Â»Â£c modifier cÃ…Â©).
   */
  devResetBranch(branchTag: string, player: PlayerData): number {
    return devResetBranchSystem(player, this.nodeRegistry, branchTag)
  }

  /**
   * skill-insight-and-auto-combat-hud-plan.md mÃ¡Â»Â¥c 5 Ã¢â‚¬â€ nÃƒÂ¢ng cÃ¡ÂºÂ¥p skill
   * bÃ¡ÂºÂ±ng CÃ¡ÂºÂ£m ngÃ¡Â»â„¢ KÃ¡Â»Â¹ nÃ„Æ’ng, thuÃ¡ÂºÂ§n pass-through xuÃ¡Â»â€˜ng SkillSystem (Ã„â€˜ÃƒÂ£ cÃƒÂ³
   * skillManager qua constructor, khÃƒÂ´ng cÃ¡ÂºÂ§n gÃƒÂ¬ thÃƒÂªm tÃ¡Â»Â« GameManager).
   */
  upgradeSkill(skillId: string, player: PlayerData): boolean {
    return this.skillSystem.upgradeSkill(skillId, player)
  }

  getSkillUpgradeInsightCost(skillId: string): number | undefined {
    return this.skillSystem.getSkillUpgradeInsightCost(skillId)
  }

  /**
   * PLAN HOÃƒâ‚¬N CHÃ¡Â»Ë†NH mÃ¡Â»Â¥c 2 Ã¢â‚¬â€ tiÃƒÂªu 1 attributePoint vÃƒÂ o Ã„ÂÃƒÅ¡NG 1 Main Stat.
   * No-op (trÃ¡ÂºÂ£ false) nÃ¡ÂºÂ¿u hÃ¡ÂºÂ¿t Ã„â€˜iÃ¡Â»Æ’m hoÃ¡ÂºÂ·c stat Ã„â€˜ÃƒÂ£ chÃ¡ÂºÂ¡m trÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ¡i cÃ¡ÂºÂ£nh
   * giÃ¡Â»â€ºi hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (getMainStatCap()) Ã¢â‚¬â€ trÃ¡ÂºÂ§n tÃƒÂ­nh riÃƒÂªng tÃ¡Â»Â«ng stat,
   * KHÃƒâ€NG cÃƒÂ³ trÃ¡ÂºÂ§n tÃ¡Â»â€¢ng cÃ¡Â»Â§a cÃ¡ÂºÂ£ 5 (Ã„â€˜ÃƒÂºng "NguyÃƒÂªn tÃ¡ÂºÂ¯c" mÃ¡Â»Â¥c 2 cÃ¡Â»Â§a doc).
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
   * TÃƒÂ¢m PhÃƒÂ¡p ChiÃ¡ÂºÂ¿n Ã„ÂÃ¡ÂºÂ¥u cÃƒÂ³ thÃ¡Â»Æ’ mang `innateSkillId` (nÃ¡Â»â„¢i tÃ¡ÂºÂ¡i chiÃ¡ÂºÂ¿n Ã„â€˜Ã¡ÂºÂ¥u
   * Ã„â€˜Ã¡ÂºÂ·c trÃ†Â°ng) Ã¢â‚¬â€ tÃ¡Â»Â± hÃ¡Â»Âc + equip skill passive Ã„â€˜ÃƒÂ³ ngay khi tÃƒÂ¢m phÃƒÂ¡p
   * Ã„â€˜Ã†Â°Ã¡Â»Â£c trang bÃ¡Â»â€¹, pattern Y HÃ¡Â»â€ T syncRealmPassive() (idempotent qua
   * skillManager.has(), un-equip technique sau Ã„â€˜ÃƒÂ³ KHÃƒâ€NG tÃ¡Â»Â± gÃ¡Â»Â¡ skill Ã¢â‚¬â€
   * giÃ¡Â»Â¯ tinh thÃ¡ÂºÂ§n "hÃ¡Â»Âc rÃ¡Â»â€œi thÃƒÂ¬ giÃ¡Â»Â¯" toÃƒÂ n hÃ¡Â»â€¡ thÃ¡Â»â€˜ng).
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

        // innateSkillId luÃƒÂ´n lÃƒÂ  passive (xem Technique.ts) Ã¢â‚¬â€ khÃƒÂ´ng
        // thuÃ¡Â»â„¢c Skill Loadout, dÃƒÂ¹ng equipWithoutSlot() nhÃ†Â° mÃ¡Â»Âi passive
        // khÃƒÂ¡c (syncRealmPassive()).
        this.skillSystem.equipWithoutSlot(technique.innateSkillId)
      }
    }

    return true
  }

  unequipTechnique(techniqueId: string): boolean {
    return this.techniqueSystem.unequip(techniqueId)
  }

  /**
   * PhÃƒÂ¡p Tu profession-tier ladder (2026-08-14, hÃ¡Â»Â£p nhÃ¡ÂºÂ¥t TÃƒÂ¢m PhÃƒÂ¡p
   * 2026-08-15) Ã¢â‚¬â€ "chÃ¡Â»Ân nghÃ¡Â»Â nghiÃ¡Â»â€¡p", MÃ¡Â»ËœT LÃ¡ÂºÂ¦N DUY NHÃ¡ÂºÂ¤T, VÃ„Â¨NH VIÃ¡Â»â€žN (xem
   * PlayerData.cultivationPath) Ã¢â‚¬â€ tÃ¡Â»Â± cÃ¡ÂºÂ¥p Ã„ÂÃƒÅ¡NG bÃ¡Â»â„¢ kit cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh cÃ¡Â»Â§a tier
   * Ã„â€˜ÃƒÂ³: 1 TÃƒÂ¢m PhÃƒÂ¡p hÃ¡Â»Â£p nhÃ¡ÂºÂ¥t (GHI Ã„ÂÃƒË† tÃƒÂ¢m phÃƒÂ¡p Ã„â€˜ang trang bÃ¡Â»â€¹, kÃ¡Â»Æ’ cÃ¡ÂºÂ£ tÃƒÂ¢m
   * phÃƒÂ¡p khÃ¡Â»Å¸i Ã„â€˜Ã¡ÂºÂ§u) + 3 skill cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh (basic/special/ultimate, GHI Ã„ÂÃƒË†
   * bÃ¡ÂºÂ¥t kÃ¡Â»Â³ skill nÃƒÂ o Ã„â€˜ang chiÃ¡ÂºÂ¿m 3 slot Ã„â€˜ÃƒÂ³). KHÃƒâ€NG phÃ¡ÂºÂ£i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng build
   * tÃ¡Â»Â± do Ã¢â‚¬â€ tÃƒÂ¡i dÃƒÂ¹ng nguyÃƒÂªn vÃ¡ÂºÂ¹n learnTechnique()/equipTechnique()/
   * learnSkill()/equipSkill() Ã„â€˜ÃƒÂ£ cÃƒÂ³.
   *
   * Nghi LÃ¡Â»â€¦ NhÃ¡ÂºÂ­p MÃƒÂ´n (2026-08-16) Ã¢â‚¬â€ chÃ¡Â»Ân path CHÃƒÂNH LÃƒâ‚¬ nghi lÃ¡Â»â€¦ Ã„â€˜Ã¡Â»â„¢t phÃƒÂ¡
   * PhÃƒÂ m NhÃƒÂ¢n -> LuyÃ¡Â»â€¡n KhÃƒÂ­ (Ã„â€˜ÃƒÂºng "Ã„â€˜Ã¡Â»â„¢t phÃƒÂ¡ lÃƒÂªn cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi mÃ¡Â»â€ºi luÃƒÂ´n cÃƒÂ³
   * nghi lÃ¡Â»â€¦" Ã¢â‚¬â€ TrÃƒÂºc CÃ†Â¡ cÃƒÂ³ Ã„ÂÃ¡Â»â„¢ KiÃ¡ÂºÂ¿p riÃƒÂªng, PhÃƒÂ m NhÃƒÂ¢n->LuyÃ¡Â»â€¡n KhÃƒÂ­ dÃƒÂ¹ng
   * chÃƒÂ­nh hÃƒÂ nh Ã„â€˜Ã¡Â»â„¢ng chÃ¡Â»Ân nghÃ¡Â»Â nÃƒÂ y thay vÃƒÂ¬ 1 nÃƒÂºt Ã„ÂÃ¡Â»â„¢t PhÃƒÂ¡ thÃ†Â°Ã¡Â»Âng, xem
   * CultivationSystem.breakthrough()'s guard chÃ¡ÂºÂ·n realmId === 'mortal').
   * NÃ¡ÂºÂ¿u player Ã„â€˜ang Ã¡Â»Å¸ PhÃƒÂ m NhÃƒÂ¢n lÃƒÂºc chÃ¡Â»Ân, atomically chuyÃ¡Â»Æ’n luÃƒÂ´n sang
   * qi_refining tÃ¡ÂºÂ§ng 1 Ã¢â‚¬â€ 3 hÃƒÂ m gÃ¡Â»Âi sau Ã„â€˜ÃƒÂ³ GIÃ¡Â»ÂNG HÃ¡Â»â€ T useBreakthrough.ts/
   * useTribulation.ts gÃ¡Â»Âi sau mÃ¡Â»Âi lÃ¡ÂºÂ§n Ã„â€˜Ã¡Â»â„¢t phÃƒÂ¡ Ã„â€˜Ã¡ÂºÂ¡i cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi.
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

    // Ki?m Th? / Ki?m Ã¯Â¿Â½ (spec 2026-08-29-kiem-the-kiem-y m?c 1) Ã¯Â¿Â½ route
    // ch?t VINH VI?N dÃ¯Â¿Â½ng lÃ¯Â¿Â½c ch?n path: Huy Ki?m (tram) dÃ¯Â¿Â½ d?t Lv3
    // (10.000 l?n tr?m) ? B?t Ki?m; chua ? Ki?m Tr?n. KHÃ¯Â¿Â½NG cÃ¯Â¿Â½n API
    // d?i route (setKiemTuRoute dÃ¯Â¿Â½ d?) Ã¯Â¿Â½ branch node cÃ¯Â¿Â½n l?i b? ?n ?
    // UI (SkillPathPanel hi?n th? dÃ¯Â¿Â½ng 1 branch theo route).
    // kit.skillIds c?a Ki?m Tu gi? KHÃ¯Â¿Â½NG dÃ¯Â¿Â½ng n?a (m?i route 1 skill
    // duy nh?t, gÃ¯Â¿Â½n trong nhÃ¯Â¿Â½nh nÃ¯Â¿Â½y) Ã¯Â¿Â½ tuple 3-skill cu dÃ¯Â¿Â½ d? kh?i
    // CultivationPathKit.
    if (pathId === 'kiem_tu') {
      const tramCasts = player.skillCastCounts?.['tram'] ?? 0
      const route: KiemTuRoute = tramCasts >= HUY_KIEM_L3_CASTS ? 'bat_kiem' : 'kiem_tran'

      player.kiemTuRoute = route

      // M?i route Ã¯Â¿Â½Ã¯Â¿Â½NG 1 active skill duy nh?t (spec m?c 5) Ã¯Â¿Â½ thÃ¯Â¿Â½o b?
      // skill kit cu + tram kh?i loadout (KHÃ¯Â¿Â½NG unlearn: PhÃ¯Â¿Â½m NhÃ¯Â¿Â½n save
      // khÃ¯Â¿Â½c v?n dÃ¯Â¿Â½ng tram du?c; Ki?m Tu dÃ¯Â¿Â½ ch?t route thÃ¯Â¿Â½ tram b? khÃ¯Â¿Â½a
      // re-equip qua guard ? SkillSystem Ã¯Â¿Â½ xem guard tram phÃ¯Â¿Â½a du?i).
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
      // Skill tree redesign (2026-08-21) Ã¢â‚¬â€ HÃ¡Â»Âa CÃ¡ÂºÂ§u ThuÃ¡ÂºÂ­t lÃƒÂ  ROOT NODE
      // cÃ¡Â»Â§a HÃ¡Â»Âa skill tree (khÃƒÂ´ng phÃ¡ÂºÂ£i 1 skill hÃ¡Â»Âc riÃƒÂªng bÃƒÂªn ngoÃƒÂ i cÃƒÂ¢y),
      // xem data/progression/PhapTuNodes.ts's FIRE_LINH_NGO Ã¢â‚¬â€ cost 0 nÃƒÂªn
      // luÃƒÂ´n mua Ã„â€˜Ã†Â°Ã¡Â»Â£c ngay, purchaseNode() tÃ¡Â»Â± lo learnSkill() qua
      // unlocksSkillIds. Sau Ã„â€˜ÃƒÂ³ trang bÃ¡Â»â€¹ NGAY vÃƒÂ o slot 0, thay vÃƒÂ¬ bÃ¡ÂºÂ¯t
      // ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i tÃ¡Â»Â± mÃ¡Â»Å¸ Node Tree + Radial Skill Selector trÃ†Â°Ã¡Â»â€ºc khi
      // Ã„â€˜ÃƒÂ¡nh Ã„â€˜Ã†Â°Ã¡Â»Â£c trÃ¡ÂºÂ­n nÃƒÂ o. equipToSlot() tÃ¡Â»Â± dÃ¡Â»Âi skill Ã„â€˜ang chiÃ¡ÂºÂ¿m slot 0
      // (TrÃ¡ÂºÂ£m cÃ¡Â»Â§a PhÃƒÂ m NhÃƒÂ¢n) Ã¢â‚¬â€ execution policy rework (plan Ã‚Â§8.6) khÃƒÂ´ng
      // cÃƒÂ²n mutual-exclusion Ã„â€˜ÃƒÂ²n cÃ†Â¡ bÃ¡ÂºÂ£n riÃƒÂªng. VÃƒÂ¬ luÃƒÂ´n cÃƒÂ³ skill ngay
      // sau bÃ†Â°Ã¡Â»â€ºc nÃƒÂ y, gate blockIfNoBasicAttack() Ã¡Â»Å¸ useBattleActions.ts/
      // useTribulation.ts Ã„â€˜ÃƒÂ£ GÃ¡Â»Â  theo (khÃƒÂ´ng cÃƒÂ²n tÃƒÂ¬nh huÃ¡Â»â€˜ng "chÃ†Â°a trang bÃ¡Â»â€¹
      // gÃƒÂ¬" nÃ¡Â»Â¯a). ThÃ¡Â»Â§y/MÃ¡Â»â„¢c/ThÃ¡Â»â€¢/Kim KHÃƒâ€NG tÃ¡Â»Â± mua Ã¢â‚¬â€ root node cÃ¡Â»Â§a 4 hÃƒÂ nh
      // Ã„â€˜ÃƒÂ³ tÃ¡Â»â€˜n 2 Skill Point, ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i tÃ¡Â»Â± mua qua Node Tree UI.
      this.purchaseNode(PHAP_TU_STARTER_NODE_ID, player)

      this.skillSystem.equipToSlot(PHAP_TU_STARTER_SKILL_ID, 0)
    }

    if (player.realmId === 'mortal') {
      // Realm Passive & Pressure System (2026-08-20) Ã¢â‚¬â€ chÃ¡Â»â€˜t BÃ¡ÂºÂ­c NhÃ¡ÂºÂ­p
      // Ã„ÂÃ¡ÂºÂ¡o TRÃ†Â¯Ã¡Â»Å¡C khi grant, Ã„â€˜Ã¡Â»Æ’ NhÃ¡ÂºÂ­p Ã„ÂÃ¡ÂºÂ¡o (RealmPassives.ts) Ã„â€˜Ã¡Â»Âc Ã„â€˜ÃƒÂºng
      // giÃƒÂ¡ trÃ¡Â»â€¹ cuÃ¡Â»â€˜i cÃƒÂ¹ng cÃ¡Â»Â§a LuyÃ¡Â»â€¡n ThÃ¡Â»Æ’ tÃ¡ÂºÂ¡i thÃ¡Â»Âi Ã„â€˜iÃ¡Â»Æ’m LÃ¡Â»â€¦ NhÃ¡ÂºÂ­p MÃƒÂ´n.
      player.breakthroughGrade = computeBreakthroughGrade(player)

      // Spec dot-pha-loi-kiep Ã¯Â¿Â½4.2 Ã¯Â¿Â½ snapshot "hoÃ¯Â¿Â½n h?o PhÃ¯Â¿Â½m NhÃ¯Â¿Â½n"
      // (5/5 main stat d?t cap mortal + Luy?n Th th? 6/6) ch?t dÃ¯Â¿Â½ng
      // lÃ¯Â¿Â½c b?m QuÃ¯Â¿Â½n KhÃ¯Â¿Â½, KHÃ¯Â¿Â½NG h?i c?u sau khi vÃ¯Â¿Â½o Luy?n KhÃ¯Â¿Â½. LÃ¯Â¿Â½ 1
      // di?u ki?n Ã¯Â¿Â½?i Ã¯Â¿Â½?o TrÃ¯Â¿Â½c Co.
      player.mortalPerfectionAchieved =
        player.bodyRefinementCompletedTiers >= BODY_REFINEMENT_TIERS.length &&
        MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= getMainStatCap('mortal'))

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      this.syncRealmPassive(player)
      this.syncRealmStatPassive(player)
    }

    // Ki?m Th? / Ki?m Ã¯Â¿Â½ (spec m?c 1/5) Ã¯Â¿Â½ grant skill route SAU realm
    // advance: root Lu?ng Nghi cÃ¯Â¿Â½ realm prereq 'qi_refining', ph?i d?i
    // L? Nh?p MÃ¯Â¿Â½n d?i realm xong m?i purchaseNode du?c. M?i route Ã¯Â¿Â½Ã¯Â¿Â½NG
    // 1 active skill ? slot 0 (don ki?m/b?t ki?m th?c ho?c da ki?m/
    // lu?ng nghi ti?n hÃ¯Â¿Â½a).
    if (pathId === 'kiem_tu' && player.kiemTuRoute === 'bat_kiem') {
      this.learnSkill('bat_kiem_thuat')
      this.skillSystem.equipToSlot('bat_kiem_thuat', 0)
    } else if (pathId === 'kiem_tu') {
      this.purchaseNode('kiem_tran_luong_nghi', player)
    }

    return true
  }

  /**
   * BÃ¡ÂºÂ£n MÃ¡Â»â€¡nh PhÃƒÂ¡p BÃ¡ÂºÂ£o (doc Ã‚Â§7.1) Ã¢â‚¬â€ chÃ¡Â»Ân/Ã„â€˜Ã¡Â»â€¢i hÃ†Â°Ã¡Â»â€ºng CÃƒÂ´ng/ThÃ¡Â»Â§/KhÃ¡Â»â€˜ng. Ã„ÂÃ¡Â»â€¢i
   * Ã„â€˜Ã†Â°Ã¡Â»Â£c NHIÃ¡Â»â‚¬U LÃ¡ÂºÂ¦N ngoÃƒÂ i combat (khÃƒÂ¡c chooseCultivationPath() Ã¡Â»Å¸ trÃƒÂªn Ã¢â‚¬â€
   * Ã„â€˜ÃƒÂ³ lÃƒÂ  lÃ¡Â»Â±a chÃ¡Â»Ân vÃ„Â©nh viÃ¡Â»â€¦n, Ã„â€˜ÃƒÂ¢y lÃƒÂ  "Ã„â€˜Ã¡Â»â€¢i miÃ¡Â»â€¦n phÃƒÂ­ ngoÃƒÂ i combat Ã„â€˜Ã¡Â»Æ’
   * test"). GiÃ¡Â»Â¯ nguyÃƒÂªn EXP/tÃ¡ÂºÂ§ng/phÃ¡ÂºÂ©m, chÃ¡Â»â€° ÃƒÂ¡p dÃ¡Â»Â¥ng tÃ¡Â»Â« trÃ¡ÂºÂ­n kÃ¡ÂºÂ¿ (runtime
   * artifact snapshot path lÃƒÂºc Battle bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u, khÃƒÂ´ng Ã„â€˜Ã¡Â»Âc lÃ¡ÂºÂ¡i giÃ¡Â»Â¯a trÃ¡ÂºÂ­n).
   * KHÃƒâ€NG dÃƒÂ¹ng window.confirm Ã¢â‚¬â€ khÃƒÂ¡c QuanKhiPanel.vue (lÃ¡Â»Â±a chÃ¡Â»Ân Ã„â€˜ÃƒÂ³
   * khÃƒÂ´ng thÃ¡Â»Æ’ Ã„â€˜Ã¡Â»â€¢i lÃ¡ÂºÂ¡i, Ã„â€˜ÃƒÂ¢y thÃƒÂ¬ cÃƒÂ³).
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
   * Ki?m Tu t? l?c (2026-08-28) t?ng cÃ¯Â¿Â½ setKiemTuRoute() d?i route
   * ngoÃ¯Â¿Â½i combat Ã¯Â¿Â½ Ã¯Â¿Â½Ã¯Â¿Â½ D? (spec 2026-08-29-kiem-the-kiem-y m?c 1): route
   * gi? ch?t VINH VI?N trong chooseCultivationPath('kiem_tu') theo
   * tram Lv3, khÃ¯Â¿Â½ng cÃ¯Â¿Â½n thao tÃ¯Â¿Â½c d?i sau nÃ¯Â¿Â½y.
   */


  /**
   * BÃ¡ÂºÂ£n MÃ¡Â»â€¡nh PhÃƒÂ¡p BÃ¡ÂºÂ£o (doc Ã‚Â§5.3) Ã¢â‚¬â€ nÃƒÂ¢ng phÃ¡ÂºÂ©m bÃ¡ÂºÂ±ng Ã„ÂoÃƒÂ¡n BÃ¡ÂºÂ£o ThÃ¡ÂºÂ¡ch, CHÃ¡Â»Ë†
   * ngoÃƒÂ i combat (transaction thÃ¡ÂºÂ­t nÃ¡ÂºÂ±m Ã¡Â»Å¸ tryUpgradeArtifactGrade() core
   * thuÃ¡ÂºÂ§n Ã¢â‚¬â€ enforce guard combat NGAY TÃ¡ÂºÂ I Ã„ÂÃƒâ€šY, khÃƒÂ´ng chÃ¡Â»â€° Ã¡Â»Å¸ UI).
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
   * PLAN HOÃƒâ‚¬N CHÃ¡Â»Ë†NH mÃ¡Â»Â¥c 8/12 Ã¢â‚¬â€ "Set Skill vÃƒÂ o Loadout" (TÃ¡ÂºÂ§ng 4), tÃƒÂ¡ch
   * biÃ¡Â»â€¡t HOÃƒâ‚¬N TOÃƒâ‚¬N khÃ¡Â»Âi learnSkill()/purchaseNode() (TÃ¡ÂºÂ§ng 3, "hÃ¡Â»Âc").
   * skillId === null thÃƒÂ¬ DÃ¡Â»Å’N slot Ã„â€˜ÃƒÂ³ (unequip skill Ã„â€˜ang chiÃ¡ÂºÂ¿m, nÃ¡ÂºÂ¿u
   * cÃƒÂ³). Validate slotIndex theo tiÃ¡ÂºÂ¿n trÃƒÂ¬nh cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi Ã¡Â»Å¸ Ã„ÂÃƒâ€šY (khÃƒÂ´ng
   * phÃ¡ÂºÂ£i SkillSystem Ã¢â‚¬â€ domain thuÃ¡ÂºÂ§n khÃƒÂ´ng biÃ¡ÂºÂ¿t realm).
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
   * Combat AI strategy (plan Ã‚Â§10) Ã¢â‚¬â€ PlayerData lÃƒÂ  nguÃ¡Â»â€œn sÃ¡Â»Â± thÃ¡ÂºÂ­t duy nhÃ¡ÂºÂ¥t;
   * UI khÃƒÂ´ng tÃ¡Â»Â± giÃ¡Â»Â¯ state. Validate qua isCombatAiStrategy() dÃƒÂ¹ng chung,
   * trÃ¡ÂºÂ£ false nÃ¡ÂºÂ¿u giÃƒÂ¡ trÃ¡Â»â€¹ sai. LÃ†Â°u tÃ¡Â»Â± kÃƒÂ­ch hoÃ¡ÂºÂ¡t qua save scheduling hiÃ¡Â»â€¡n
   * cÃƒÂ³ (autosave/visibilitychange) sau khi UI bumpState().
   */
  setCombatAiStrategy(player: PlayerData, strategy: CombatAiStrategy): boolean {
    if (!isCombatAiStrategy(strategy)) {
      return false
    }

    player.combatAiStrategy = strategy

    return true
  }

  // Core Loop Foundation checklist (MÃ¡Â»Â¥c SKILL) Ã¢â‚¬â€ "behavior-changing
  // node".
  selectSkillSpecialization(skillId: string, specializationId: string): boolean {
    return this.skillSystem.selectSpecialization(skillId, specializationId)
  }

  // =========================
  // MODIFIER AGGREGATION
  // =========================

  /**
   * Modifier tÃ¡Â»â€¢ng hÃ¡Â»Â£p tÃ¡Â»Â« Buff + Technique Ã„â€˜ang trang bÃ¡Â»â€¹ + Skill
   * passive Ã„â€˜ang equipped. Stack cÃ¡Â»Â§a passiveModifiers Ã„â€˜Ã†Â°Ã¡Â»Â£c
   * PassiveSystem tÃƒÂ­ch trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p lÃƒÂªn object Skill (xem
   * PassiveSystem.ts) nÃƒÂªn chÃ¡Â»â€° cÃ¡ÂºÂ§n Ã„â€˜Ã¡Â»Âc thÃ¡ÂºÂ³ng tÃ¡Â»Â« skillManager, khÃƒÂ´ng
   * cÃ¡ÂºÂ§n mÃ¡Â»â„¢t bÃ†Â°Ã¡Â»â€ºc "gÃ¡Â»â„¢p" riÃƒÂªng nhÃ†Â° trÃ†Â°Ã¡Â»â€ºc Ã„â€˜ÃƒÂ¢y comment cÃ…Â© nhÃ¡ÂºÂ¯c tÃ¡Â»â€ºi.
   *
   * Ã„ÂÃƒÂ¢y lÃƒÂ  Ã„â€˜iÃ¡Â»Æ’m duy nhÃ¡ÂºÂ¥t trong toÃƒÂ n bÃ¡Â»â„¢ game tÃ¡Â»â€¢ng hÃ¡Â»Â£p modifier
   * theo thÃ¡Â»Âi gian thÃ¡Â»Â±c. player.ts (store) chÃ¡Â»â€° cÃ¡ÂºÂ§n gÃ¡Â»Âi hÃƒÂ m nÃƒÂ y
   * mÃ¡Â»â€”i tick thay vÃƒÂ¬ tÃ¡Â»Â± Ã„â€˜i gÃ¡Â»â„¢p tÃ¡Â»Â« buffSystem/techniqueSystem/skillManager.
   */
  /**
   * `player` optional (mÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»â€¹nh bÃ¡Â»Â qua tier tÃƒÂ¢m phÃƒÂ¡p) Ã¢â‚¬â€ nhiÃ¡Â»Âu call site
   * cÃ…Â© (test files, vÃƒÂ i panel refresh phÃ¡Â»Â¥) gÃ¡Â»Âi hÃƒÂ m nÃƒÂ y KHÃƒâ€NG cÃƒÂ³ sÃ¡ÂºÂµn
   * PlayerData tiÃ¡Â»â€¡n tay; chÃ¡Â»Â¯ kÃƒÂ½ cÃ…Â© vÃ¡ÂºÂ«n hÃ¡Â»Â£p lÃ¡Â»â€¡ nguyÃƒÂªn vÃ¡ÂºÂ¹n. Call site
   * "thÃ¡ÂºÂ­t" mÃ¡Â»â€”i tick (App.vue) LUÃƒâ€N truyÃ¡Â»Ân player Ã„â€˜Ã¡Â»Æ’ tier tÃƒÂ¢m phÃƒÂ¡p cÃƒÂ³
   * hiÃ¡Â»â€¡u lÃ¡Â»Â±c Ã¢â‚¬â€ xem getTechniqueTierModifiers().
   */
  getAggregatedModifiers(player?: PlayerData): StatModifier[] {
    // STATIC-ONLY (2026-08-24, plan Ã‚Â§5.4): timed effect + socket
    // PhÃƒÂ¹/TrÃ¡ÂºÂ­n lÃƒÂ  modifier SÃ¡Â»ÂNG Ã¢â‚¬â€ KHÃƒâ€NG nÃ¡ÂºÂ±m Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y Ã„â€˜Ã¡Â»Æ’ finalStats caller
    // truyÃ¡Â»Ân vÃƒÂ o battle lÃƒÂ  snapshot tÃ„Â©nh sÃ¡ÂºÂ¡ch (khÃƒÂ´ng double-apply);
    // combat recompute nhÃ¡ÂºÂ­n runtime qua provider mÃ¡Â»â€”i tick, menu hiÃ¡Â»Æ’n thÃ¡Â»â€¹
    // qua store getter cÃ¡Â»â„¢ng getActiveRuntimeModifiers().
    return [
      ...this.buffSystem.getActiveModifiers(),
      // Core Loop Foundation checklist (MÃ¡Â»Â¥c SKILL) - qua
      // getScaledPassiveModifiers() thay vÃƒÂ¬ Ã„â€˜Ã¡Â»Âc thÃ¡ÂºÂ³ng
      // skill.passiveModifiers, Ã„â€˜Ã¡Â»Æ’ ÃƒÂ¡p Specialization + level scaling.
      ...this.skillSystem.getScaledPassiveModifiers(),
      ...(player ? this.getTechniqueTierModifiers(player) : []),
      ...(player ? getCultivationPathStatModifiers(player) : []),
      // Node level (plan Ã‚Â§6.8) Ã¢â‚¬â€ modifier node suy ra tÃ¡Â»Â« (registry,
      // nodeLevels), scale theo level hiÃ¡Â»â€¡n hÃƒÂ nh; KHÃƒâ€NG nÃ¡ÂºÂ±m trong
      // player.modifiers nÃ¡Â»Â¯a.
      ...(player ? aggregateNodeStatModifiers(this.nodeRegistry, player) : []),
      // Combat-gate-teleport-autocast plan Ã‚Â§9 Ã¢â‚¬â€ combatModifiers cÃ¡Â»Â§a tÃƒÂ¢m
      // phÃƒÂ¡p Ã„ÂANG trang bÃ¡Â»â€¹ (+2 attackRange Ã„ÂÃ¡ÂºÂ¡i NgÃ…Â© HÃƒÂ nh ChÃƒÂ¢n QuyÃ¡ÂºÂ¿t):
      // cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh, khÃƒÂ´ng theo tier, chÃ¡Â»â€° khi equipped. DUY NHÃ¡ÂºÂ¤T Ã„â€˜Ã†Â°Ã¡Â»Âng tÃ¡Â»â€¢ng
      // hÃ¡Â»Â£p Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh cÃ¡Â»â„¢ng hai lÃ¡ÂºÂ§n.
      ...this.getTechniqueCombatModifiers(),
    ]
  }

  /** Modifier combat cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh cÃ¡Â»Â§a tÃƒÂ¢m phÃƒÂ¡p Ã„â€˜ang trang bÃ¡Â»â€¹ (plan Ã‚Â§9). */
  private getTechniqueCombatModifiers(): StatModifier[] {
    const technique = this.techniqueManager.getEquipped()

    if (!technique?.equipped || !technique.combatModifiers) {
      return []
    }

    return [...technique.combatModifiers]
  }

  /**
   * PLAN HOÃƒâ‚¬N CHÃ¡Â»Ë†NH mÃ¡Â»Â¥c 5 rework (2026-08-20) Ã¢â‚¬â€ hiÃ¡Â»â€¡u Ã¡Â»Â©ng chÃ¡Â»â€° sÃ¡Â»â€˜ cÃ¡Â»Â§a tÃƒÂ¢m
   * phÃƒÂ¡p Ã„ÂANG trang bÃ¡Â»â€¹, theo Ã„ÂÃƒÅ¡NG tier hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (getTechniqueTier(),
   * giÃ¡Â»Â tÃƒÂ­nh tÃ¡Â»Â« techniqueExperience Ã¢â‚¬â€ thanh kinh nghiÃ¡Â»â€¡m riÃƒÂªng cÃ¡Â»Â§a TÃƒÂ¢m
   * PhÃƒÂ¡p, xem TechniqueTier.ts). manaRegenPercent cÃ¡Â»â€˜ ÃƒÂ½ map vÃƒÂ o percent
   * CÃ¡Â»Â¦A stat manaRegenPerSecond (Increased chuÃ¡ÂºÂ©n, xem StatCalculator.ts's
   * runPipeline) thay vÃƒÂ¬ %maxMp Ã¢â‚¬â€ %maxMp sÃ¡ÂºÂ½ tÃ¡ÂºÂ¡o phÃ¡Â»Â¥ thuÃ¡Â»â„¢c vÃƒÂ²ng (maxMp
   * chÃ†Â°a tÃƒÂ­nh xong ngay tÃ¡ÂºÂ¡i bÃ†Â°Ã¡Â»â€ºc gÃ¡Â»â„¢p modifier nÃƒÂ y).
   */
  // =========================
  // RUNTIME MODIFIER AUTHORITY (2026-08-24, resource-professions-rework
  // Phase 4/6 Ã¢â‚¬â€ plan Ã‚Â§5.4/Ã‚Â§7.2): modifier SÃ¡Â»ÂNG theo thÃ¡Â»Âi gian (timed
  // effect) + modifier socket trÃƒÂªn slot (PhÃƒÂ¹/TrÃ¡ÂºÂ­n). MÃ¡Â»ËœT authority duy
  // nhÃ¡ÂºÂ¥t Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y Ã¢â‚¬â€ menu (getAggregatedModifiers) vÃƒÂ  combat recompute
  // (BattleSystem qua provider) cÃƒÂ¹ng Ã„â€˜Ã¡Â»Âc, khÃƒÂ´ng hai bÃ¡ÂºÂ£n sao lÃ¡Â»â€¡ch nhau.
  // KHÃƒâ€NG bao giÃ¡Â»Â vÃƒÂ o CombatEntity.baseStats snapshot.
  // =========================

  private activePlayer?: PlayerData

  /**
   * App.vue Ã„â€˜Ã„Æ’ng kÃƒÂ½ player sau boot/load Ã¢â‚¬â€ update() dÃƒÂ¹ng Ã„â€˜Ã¡Â»Æ’ tick expiry
   * timed effect theo Date.now().
   */
  setActivePlayer(player: PlayerData) {
    this.activePlayer = player

    // Load save: b? effect dÃ¯Â¿Â½ h?t h?n ngay (plan Ã¯Â¿Â½9).
    this.tickTimedEffects(player)

    // Talent v4 (spec 2026-09-03 Ã¯Â¿Â½4.1) Ã¯Â¿Â½ grant hidden passive c?a
    // talent combat ngay khi active player d?i (load save / restore /
    // sau L? Nh?p MÃ¯Â¿Â½n t?o nhÃ¯Â¿Â½n v?t).
    this.syncTalentCombatPassive(player)
  }

  getActiveTimedModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > now)
      .flatMap((effect) => effect.modifiers)
  }

  /**
   * ToÃƒÂ n bÃ¡Â»â„¢ modifier SÃ¡Â»ÂNG cÃ¡Â»Â§a player: timed effect + socket PhÃƒÂ¹/TrÃ¡ÂºÂ­n
   * trÃƒÂªn slot Ã„â€˜ang cÃƒÂ³ equipment. Battle recompute gÃ¡Â»Âi qua provider mÃ¡Â»â€”i
   * tick Ã¢â‚¬â€ effect hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n giÃ¡Â»Â¯a trÃ¡ÂºÂ­n tÃ¡Â»Â± rÃ†Â¡i khÃ¡Â»Âi recompute kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p.
   */
  getActiveRuntimeModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return [...this.getActiveTimedModifiers(player, now), ...this.getSlotModifiers()]
  }

  /**
   * Stack policy MVP (plan Ã‚Â§5.4): cÃƒÂ¹ng effectGroup Ã¢â€ â€™ refresh deadline
   * (max) vÃƒÂ  giÃ¡Â»Â¯ giÃƒÂ¡ trÃ¡Â»â€¹ mÃ¡ÂºÂ¡nh hÃ†Â¡n per-modifier; khÃƒÂ¡c nhÃƒÂ³m Ã¢â€ â€™ thÃƒÂªm mÃ¡Â»â€ºi.
   *
   * Merge key theo IDENTITY THÃ¡Â»Â°C cÃ¡Â»Â§a modifier: `stat` + `tag` (tag phÃƒÂ¢n
   * biÃ¡Â»â€¡t pool Increased trong runPipeline(), xem StatCalculator) Ã¢â‚¬â€ KHÃƒâ€NG
   * dÃƒÂ¹ng giÃƒÂ¡ trÃ¡Â»â€¹ `percent` lÃƒÂ m key (bug audit P0-1: hai percent khÃƒÂ¡c nhau
   * cÃ¡Â»Â§a cÃƒÂ¹ng stat khÃƒÂ´ng match vÃƒÂ  cÃ¡Â»â„¢ng dÃ¡Â»â€œn ngoÃƒÂ i policy). Khi match, chÃ¡Â»Ân
   * giÃƒÂ¡ trÃ¡Â»â€¹ mÃ¡ÂºÂ¡nh hÃ†Â¡n RIÃƒÅ NG cho flat/percent/multiplier Ã„â€˜Ã¡Â»Æ’ modifier yÃ¡ÂºÂ¿u vÃƒÂ 
   * mÃ¡ÂºÂ¡nh khÃƒÂ´ng cÃƒÂ¹ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i.
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

  /** BÃ¡Â»Â effect hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n Ã¢â‚¬â€ trÃ¡ÂºÂ£ sÃ¡Â»â€˜ effect Ã„â€˜ÃƒÂ£ rÃ†Â¡i (debug/test). */
  tickTimedEffects(player: PlayerData, now = Date.now()): number {
    const before = player.persistentTimedEffects.length

    player.persistentTimedEffects = player.persistentTimedEffects.filter(
      (effect) => effect.expiresAtMs > now,
    )

    return before - player.persistentTimedEffects.length
  }

  /**
   * T? LINH TR?N (economy-fixes-sinks-plan Ã¯Â¿Â½3.2 B1, 2026-08-29) Ã¯Â¿Â½ sink
   * Linh Th?ch mua % t?c d? tu luy?n 24h. Cost leo thang theo s? effect
   * CÃ¯Â¿Â½NG NHÃ¯Â¿Â½M dang active (expiresAtMs > now); ch? M?T effect group t?n
   * t?i t?i 1 th?i di?m (stack policy MVP c?a applyTimedEffect Ã¯Â¿Â½ refresh
   * deadline). Giao d?ch atomic: thi?u Linh Th?ch ? khÃ¯Â¿Â½ng tr? gÃ¯Â¿Â½.
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
   * NguÃ¡Â»â€œn DUY NHÃ¡ÂºÂ¤T tÃ¡Â»â€¢ng hÃ¡Â»Â£p 2+2 modifier PhÃƒÂ¹/TrÃ¡ÂºÂ­n trÃƒÂªn cÃƒÂ¡c slot Ã„â€˜ang cÃƒÂ³
   * equipment (plan Ã‚Â§7.2). Socket modifier giÃ¡Â»Â¯ sourceId/sourceType Ã¡Â»â€¢n
   * Ã„â€˜Ã¡Â»â€¹nh Ã„â€˜Ã¡Â»Æ’ tooltip/debug truy nguÃ¡Â»â€œn, KHÃƒâ€NG vÃƒÂ o baseStats snapshot.
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

    // YÃƒÂªu cÃ¡ÂºÂ§u 2026-08-26 Ã¢â‚¬â€ HP/s & MP/s mÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»â€¹nh cÃ¡Â»Â§a tÃƒÂ¢m phÃƒÂ¡p: flat trÃ¡Â»Â±c
    // tiÃ¡ÂºÂ¿p lÃƒÂªn 2 stat hÃ¡Â»â€œi/giÃƒÂ¢y, ÃƒÂ¡p cho MÃ¡Â»Å’I technique khai tierEffects.
    if (effect.hpRegenFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:hpRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'hpRegenPerTurn',
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
   * MÃ¡Â»Å¸ khÃƒÂ³a + tÃ¡Â»Â± equip passive skill Ã¡Â»Â©ng vÃ¡Â»â€ºi cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i cÃ¡Â»Â§a
   * player Ã¢â‚¬â€ gÃ¡Â»Âi ngay sau breakthrough() thÃƒÂ nh cÃƒÂ´ng. NguÃ¡Â»â€œn passive
   * giÃ¡Â»Â Ã„â€˜Ã¡ÂºÂ¿n tÃ¡Â»Â« tÃƒÂ¢m phÃƒÂ¡p Ã„ÂANG trang bÃ¡Â»â€¹ (Technique.passiveSkillIdsByRealm,
   * hÃ¡Â»Â£p nhÃ¡ÂºÂ¥t 2026-08-15 Ã¢â‚¬â€ khÃƒÂ´ng cÃƒÂ²n slot 'cultivation' riÃƒÂªng), khÃƒÂ´ng
   * cÃƒÂ²n cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh theo cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi (RealmData.unlockSkillId cÃ…Â©) Ã¢â‚¬â€ Ã„â€˜Ã¡Â»â€¢i tÃƒÂ¢m
   * phÃƒÂ¡p thÃƒÂ¬ 9 passive tÃ†Â°Ã†Â¡ng lai cÃ…Â©ng Ã„â€˜Ã¡Â»â€¢i theo, passive Ã„â€˜ÃƒÂ£ hÃ¡Â»Âc trÃ†Â°Ã¡Â»â€ºc
   * Ã„â€˜ÃƒÂ³ thÃƒÂ¬ giÃ¡Â»Â¯ nguyÃƒÂªn. KhÃƒÂ´ng cÃƒÂ³ tÃƒÂ¢m phÃƒÂ¡p nÃƒÂ o Ã„â€˜ang trang bÃ¡Â»â€¹ thÃƒÂ¬ khÃƒÂ´ng
   * cÃƒÂ³ passive nÃƒÂ o Ã„â€˜Ã†Â°Ã¡Â»Â£c hÃ¡Â»Âc. Idempotent (kiÃ¡Â»Æ’m tra skillManager.has()
   * trÃ†Â°Ã¡Â»â€ºc khi learn) nÃƒÂªn an toÃƒÂ n khi gÃ¡Â»Âi lÃ¡ÂºÂ·p hoÃ¡ÂºÂ·c sau khi load save.
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

    // Passive KHÃƒâ€NG thuÃ¡Â»â„¢c Skill Loadout (khÃƒÂ´ng tranh slot vÃ¡Â»â€ºi active
    // skill) Ã¢â‚¬â€ equipWithoutSlot() y hÃ¡Â»â€¡t hÃƒÂ nh vi equip() cÃ…Â© cho passive.
    this.skillSystem.equipWithoutSlot(skillId)
  }

  /**
   * Realm Passive & Pressure System (2026-08-20) Ã¢â‚¬â€ cÃ¡ÂºÂ¥p buff VÃ„Â¨NH VIÃ¡Â»â€žN
   * (NhÃ¡ÂºÂ­p Ã„ÂÃ¡ÂºÂ¡o/KiÃ¡ÂºÂ¿n CÃ†Â¡/..., xem data/realm/RealmPassives.ts) cÃ¡Â»Â§a cÃ¡ÂºÂ£nh
   * giÃ¡Â»â€ºi HIÃ¡Â»â€ N TÃ¡ÂºÂ I, tÃƒÂªn tÃƒÂ¡ch biÃ¡Â»â€¡t syncRealmPassive() Ã¡Â»Å¸ trÃƒÂªn (Ã„â€˜ÃƒÂ³ lÃƒÂ 
   * passive SKILL theo tÃƒÂ¢m phÃƒÂ¡p, Ã„â€˜ÃƒÂ¢y lÃƒÂ  stat modifier theo Breakthrough
   * Grade/LoÃ¡ÂºÂ¡i TrÃƒÂºc CÃ†Â¡) Ã„â€˜Ã¡Â»Æ’ khÃ¡Â»Âi nhÃ¡ÂºÂ§m 2 khÃƒÂ¡i niÃ¡Â»â€¡m. Idempotent (xem
   * RealmPassiveSystem.grantRealmPassive()) Ã¢â‚¬â€ gÃ¡Â»Âi cÃƒÂ¹ng 3 Ã„â€˜iÃ¡Â»Æ’m vÃ¡Â»â€ºi
   * syncRealmPassive() (chooseCultivationPath() dÃ†Â°Ã¡Â»â€ºi Ã„â€˜ÃƒÂ¢y,
   * useBreakthrough.ts, useTribulation.ts's resolveVictory()).
   */
  syncRealmStatPassive(player: PlayerData) {
    grantRealmPassive(player, getCurrentRealm(player.realmId).id)
  }

  /**
   * Ã„ÂÃ¡ÂºÂ§u tÃ†Â° Tinh Hoa PhÃƒÂ m ThÃ¡Â»Æ’ (Ã„â€˜ang cÃ¡ÂºÂ§m trong materialBag) vÃƒÂ o tÃ¡ÂºÂ§ng
   * LuyÃ¡Â»â€¡n ThÃ¡Â»Æ’ Ã„â€˜ang dÃ¡Â»Å¸ Ã¢â‚¬â€ xem core/realm/BodyRefinementSystem.ts. TrÃ¡ÂºÂ£ vÃ¡Â»Â sÃ¡Â»â€˜
   * Tinh Hoa thÃ¡ÂºÂ­t sÃ¡Â»Â± Ã„â€˜ÃƒÂ£ tiÃƒÂªu (0 nÃ¡ÂºÂ¿u khÃƒÂ´ng cÃƒÂ²n tÃ¡ÂºÂ§ng nÃƒÂ o Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã¡ÂºÂ§u tÃ†Â° hoÃ¡ÂºÂ·c
   * khÃƒÂ´ng cÃ¡ÂºÂ§m Tinh Hoa nÃƒÂ o).
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
   * Gate d?t phÃ¯Â¿Â½ unified Ã¯Â¿Â½ 1 hÃ¯Â¿Â½m cho M?I c?nh gi?i. Tr? v? true n?u
   * ngu?i choi d? di?u ki?n b?m nÃ¯Â¿Â½t Ã¯Â¿Â½?t PhÃ¯Â¿Â½ (QuÃ¯Â¿Â½n KhÃ¯Â¿Â½ / TrÃ¯Â¿Â½c Co / ...).
   *
   * PRODUCT SCOPE: game hi?n ch? thi?t k? t?i TrÃ¯Â¿Â½c Co t?ng 18. CÃ¯Â¿Â½c realm
   * placeholder (Kim Ã¯Â¿Â½an+) tr? false cho t?i khi cÃ¯Â¿Â½ content pass tuong ?ng.
   */
  canTriggerBreakthrough(player: PlayerData): boolean {
    if (player.realmId === 'mortal' || player.realmId === 'qi_refining') {
      return player.realmLevel >= CORE_REALM_LEVEL
    }
    return false
  }

  /**
   * Quy d?i Linh Th?ch LÃ¯Â¿Â½N ph?m k? ti?p (review 2026-08-28,
   * economy-ecosystem-plan T2): 100 H? ? 1 Trung, 100 Trung ? 1 Thu?ng.
   * CH? cÃ¯Â¿Â½ chi?u lÃ¯Â¿Â½n Ã¯Â¿Â½ khÃ¯Â¿Â½ng cÃ¯Â¿Â½ quy d?i ngu?c (gi? sink). Giao d?ch
   * atomic: check d? ? tr? ? c?ng; tr? th?t b?i thÃ¯Â¿Â½ khÃ¯Â¿Â½ng c?ng.

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
      // TrÃ¡ÂºÂ§n stack Linh ThÃ¡ÂºÂ¡ch lÃƒÂ  MAX_SAFE_INTEGER nÃƒÂªn thÃ¡Â»Â±c tÃ¡ÂºÂ¿ khÃƒÂ´ng xÃ¡ÂºÂ£y
      // ra; nÃ¡ÂºÂ¿u xÃ¡ÂºÂ£y ra thÃƒÂ¬ hoÃƒÂ n lÃ¡ÂºÂ¡i phÃ¡ÂºÂ©m thÃ¡ÂºÂ¥p Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng mÃ¡ÂºÂ¥t trÃ¡ÂºÂ¯ng.
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
   * Quy Ã„â€˜Ã¡Â»â€¢i cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi Linh MÃ¡Â»â„¢c/Linh KhoÃƒÂ¡ng LÃƒÅ N bÃ¡ÂºÂ­c kÃ¡ÂºÂ¿ (2026-08-28): gÃ¡Â»â„¢p
   * 10 bÃ¡ÂºÂ­c thÃ¡ÂºÂ¥p Ã¢â€ â€™ 1 bÃ¡ÂºÂ­c cao theo thang PhÃƒÂ m NhÃƒÂ¢n Ã¢â€ â€™ LuyÃ¡Â»â€¡n KhÃƒÂ­ Ã¢â€ â€™ TrÃƒÂºc CÃ†Â¡.
   * GÃ¡Â»â€” `<realm>_wood` Ã¢â€ â€™ `<nextRealm>_wood`; quÃƒÂ¡ng giÃ¡Â»Â¯ PHÃ¡ÂºÂ¨M khi lÃƒÂªn cÃ¡ÂºÂ£nh
   * giÃ¡Â»â€ºi `<realm>_ore_<quality>` Ã¢â€ â€™ `<nextRealm>_ore_<quality>`. CHÃ¡Â»Ë† cÃƒÂ³
   * chiÃ¡Â»Âu lÃƒÂªn (giÃ¡Â»Â¯ sink). Giao dÃ¡Â»â€¹ch atomic: check Ã„â€˜Ã¡Â»Â§ Ã¢â€ â€™ trÃ¡Â»Â« Ã¢â€ â€™ cÃ¡Â»â„¢ng; trÃ¡Â»Â«
   * thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i thÃƒÂ¬ khÃƒÂ´ng cÃ¡Â»â„¢ng.
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
   * HÃ¯Â¿Â½A BÃ¯Â¿Â½N (economy-fixes-sinks-plan Ã¯Â¿Â½3.2 B2, 2026-08-29) Ã¯Â¿Â½ bÃ¯Â¿Â½n nguyÃ¯Â¿Â½n
   * li?u th?a cho Vendor l?y Linh Th?ch dÃ¯Â¿Â½ng ph?m. VendorSystem kh?i t?o
   * per-call (nh?, stateless) v?i registry + dan phuong hi?n hÃ¯Â¿Â½nh Ã¯Â¿Â½ sole-
   * ingredient guard c?n danh sÃ¯Â¿Â½ch herbVariants c?a m?i recipe.
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
   * Danh sÃ¯Â¿Â½ch material ngu?i choi Ã¯Â¿Â½ANG S? H?U vÃ¯Â¿Â½ bÃ¯Â¿Â½n du?c cho Vendor
   * (KÃ¯Â¿Â½ B?o CÃ¯Â¿Â½c, 2026-08-30) Ã¯Â¿Â½ dÃ¯Â¿Â½ng cho VendorPanel.vue li?t kÃ¯Â¿Â½ UI, tÃ¯Â¿Â½ch
   * kh?i sellMaterialToVendor() (hÃ¯Â¿Â½nh d?ng) d? panel khÃ¯Â¿Â½ng t? l?p logic
   * l?c category/giÃ¯Â¿Â½.
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

  // TÃ¯Â¿Â½ch kh?i GameManager (2026-09-02, task 1 Ã¯Â¿Â½ GameManager split) Ã¯Â¿Â½
  // toÃ¯Â¿Â½n b? logic dÃ¯Â¿Â½ chuy?n sang EquipmentOpsSystem (xem
  // EquipmentOpsSystem.ts). CÃ¯Â¿Â½c method du?i dÃ¯Â¿Â½y lÃ¯Â¿Â½ thin delegate GI?
  // NGUYÃ¯Â¿Â½N public API d? call site ngoÃ¯Â¿Â½i GameManager.ts khÃ¯Â¿Â½ng ph?i d?i.

  obtainEquipment(equipmentId: string, player: PlayerData): EquipmentInstance | null {
    return this.equipmentOps.obtainEquipment(equipmentId, player)
  }

  equipItem(instanceId: string, player: PlayerData): { ok: boolean; reason?: string } {
    return this.equipmentOps.equipItem(instanceId, player)
  }

  unequipItem(instanceId: string): boolean {
    return this.equipmentOps.unequipItem(instanceId)
  }

  enhanceSlot(slot: EquipmentSlot, player: PlayerData): { ok: boolean; reason?: string } {
    return this.equipmentOps.enhanceSlot(slot, player)
  }

  getEnhanceCost(slot: EquipmentSlot, realmId: string) {
    return this.equipmentOps.getEnhanceCost(slot, realmId)
  }

  getEnhanceSpiritStoneCost(slot: EquipmentSlot, realmId: string): number {
    return this.equipmentOps.getEnhanceSpiritStoneCost(slot, realmId)
  }

  getSlotMaxEnhanceLevel(slot: EquipmentSlot, realmId: string): number {
    return this.equipmentOps.getSlotMaxEnhanceLevel(slot, realmId)
  }

  getEquipmentTemplate(itemId: string): Equipment | undefined {
    return this.equipmentOps.getEquipmentTemplate(itemId)
  }

  itemRefinementPoints(instance: EquipmentInstance): number {
    return this.equipmentOps.itemRefinementPoints(instance)
  }

  washItem(instanceId: string, player: PlayerData): { ok: boolean; reason?: string } {
    return this.equipmentOps.washItem(instanceId, player)
  }

  refineItem(
    instanceId: string,
    lockedIndices: readonly number[],
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    return this.equipmentOps.refineItem(instanceId, lockedIndices, player)
  }

  previewWashItem(instanceId: string): { ok: boolean; reason?: string; affixes?: RolledAffix[] } {
    return this.equipmentOps.previewWashItem(instanceId)
  }

  commitWashItem(instanceId: string, affixes: RolledAffix[]): { ok: boolean; reason?: string } {
    return this.equipmentOps.commitWashItem(instanceId, affixes)
  }

  previewRefineItem(
    instanceId: string,
    lockedIndices: readonly number[],
  ): { ok: boolean; reason?: string; values?: RefineValueEntry[] } {
    return this.equipmentOps.previewRefineItem(instanceId, lockedIndices)
  }

  commitRefineItem(instanceId: string, values: RefineValueEntry[]): { ok: boolean; reason?: string } {
    return this.equipmentOps.commitRefineItem(instanceId, values)
  }

  discardRefinePreview(instanceId?: string): void {
    this.equipmentOps.discardRefinePreview(instanceId)
  }

  getWashCost(quality: ItemQuality) {
    return this.equipmentOps.getWashCost(quality)
  }

  getRefineCost(lineCount: number, lockedCount: number, quality?: ItemQuality) {
    return this.equipmentOps.getRefineCost(lineCount, lockedCount, quality)
  }

  dissolveItems(instanceIds: readonly string[]): {
    ok: boolean
    reason?: string
    rewards?: Array<{ materialId: string; amount: number }>
  } {
    return this.equipmentOps.dissolveItems(instanceIds)
  }

  previewDissolveRewards(
    instanceIds: readonly string[],
  ): Array<{ materialId: string; minAmount: number; maxAmount: number }> {
    return this.equipmentOps.previewDissolveRewards(instanceIds)
  }

  getSlotState(slot: EquipmentSlot): EquipmentSlotState {
    return this.equipmentOps.getSlotState(slot)
  }

  getAllSlotStates(): EquipmentSlotState[] {
    return this.equipmentOps.getAllSlotStates()
  }

  getEquipmentModifiers(): StatModifier[] {
    return this.equipmentOps.getEquipmentModifiers()
  }

  unequipAllEquipment(): void {
    this.equipmentOps.unequipAllEquipment()
  }

  // =========================
  // FORMATION
  // =========================

  // KhÃƒÂ´ng cÃƒÂ²n nhÃ¡ÂºÂ­n instanceId (MASTER SPEC MÃ¡Â»Â¥c XVI, Phase 9) Ã¢â‚¬â€ trÃ¡ÂºÂ­n

  // =========================
  // RECIPE / CRAFTING (Ã„Âan/PhÃƒÂ¹/TrÃ¡ÂºÂ­n Ã¢â‚¬â€ KhÃƒÂ­ dÃƒÂ¹ng EquipmentSystem, khÃƒÂ´ng qua Ã„â€˜ÃƒÂ¢y)
  // =========================

  // BUILDing spec mÃ¡Â»Â¥c 15-16 Ã¢â‚¬â€ Building crafting-station (Ã„Âan PhÃƒÂ²ng/

  // =========================
  // PILL
  // =========================

  /**
   * UÃ¡Â»â€˜ng pill (2026-08-24, plan Ã‚Â§5.2) Ã¢â‚¬â€ ATOMIC consumption: mÃ¡Â»Âi
   * validation + apply thÃƒÂ nh cÃƒÂ´ng rÃ¡Â»â€œi mÃ¡Â»â€ºi remove khÃ¡Â»Âi PillBag. Pill
   * nghÃ¡Â»Â (cÃƒÂ³ realmId): gate Ã„ÂÃƒÅ¡NG cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi + 4 effect MVP; legacy pill
   * (khÃƒÂ´ng realmId) giÃ¡Â»Â¯ hÃƒÂ nh vi cÃ…Â©. `random` inject cho main stat roll.
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

    // Exact-realm gate cho pill nghÃ¡Â»Â (plan Ã‚Â§5.2).
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

    // Legacy path Ã¢â‚¬â€ giÃ¡Â»Â¯ nguyÃƒÂªn hÃƒÂ nh vi cÃ…Â© (permanent_stat cap + heal/
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
  // BUILDING + PRODUCTION Ã¯Â¿Â½ toÃ¯Â¿Â½n b? logic dÃ¯Â¿Â½ chuy?n sang
  // GameManagerBuildingOps (xem GameManagerBuildingOps.ts, task 2 Ã¯Â¿Â½
  // GameManager split). CÃ¯Â¿Â½c method du?i dÃ¯Â¿Â½y lÃ¯Â¿Â½ thin delegate GI? public
  // API cho UI/composables/tests.
  // =========================

  getBuildingDefinitions(): Building[] {
    return this.buildingOps.getBuildingDefinitions()
  }

  canBuildBuilding(buildingId: string, player: PlayerData): boolean {
    return this.buildingOps.canBuildBuilding(buildingId, player)
  }

  buildBuilding(buildingId: string, player: PlayerData, currentTime = Date.now() / 1000) {
    return this.buildingOps.buildBuilding(buildingId, player, currentTime)
  }

  refreshAutoWorkerCapacity(player: PlayerData, instance: BuildingInstance): void {
    this.buildingOps.refreshAutoWorkerCapacity(player, instance)
  }

  getWorkerAssignments(): Map<string, number> {
    return this.buildingOps.getWorkerAssignments()
  }

  assignWorkers(siteId: string, count: number | undefined): void {
    this.buildingOps.assignWorkers(siteId, count)
  }

  upgradeBuilding(instanceId: string): boolean {
    return this.buildingOps.upgradeBuilding(instanceId)
  }

  getEnemyTemplate(enemyId: string): Enemy | undefined {
    return this.enemyTemplates.get(enemyId)
  }

  collectBuilding(instanceId: string, player: PlayerData, currentTime = Date.now() / 1000): number {
    return this.buildingOps.collectBuilding(instanceId, player, currentTime)
  }

  getBuildingStoredAmount(instanceId: string, currentTime = Date.now() / 1000): number {
    return this.buildingOps.getBuildingStoredAmount(instanceId, currentTime)
  }

  getBuildingCapacity(instanceId: string): number {
    return this.buildingOps.getBuildingCapacity(instanceId)
  }

  getBuildingRatePerMinute(instanceId: string): number {
    return this.buildingOps.getBuildingRatePerMinute(instanceId)
  }

  getProductionViews(nowMs = Date.now()) {
    return this.buildingOps.getProductionViews(nowMs)
  }

  startProductionCycle(siteId: string, player: PlayerData): boolean {
    return this.buildingOps.startProductionCycle(siteId, player)
  }

  setProductionAutoRestart(siteId: string, enabled: boolean): boolean {
    return this.buildingOps.setProductionAutoRestart(siteId, enabled)
  }

  upgradeProductionSite(siteId: string, player: PlayerData): boolean {
    return this.buildingOps.upgradeProductionSite(siteId, player)
  }

  getProductionUpgradeCost(siteId: string) {
    return this.buildingOps.getProductionUpgradeCost(siteId)
  }

  // =========================
  // ALCHEMY Ã¯Â¿Â½ toÃ¯Â¿Â½n b? logic dÃ¯Â¿Â½ chuy?n sang GameManagerAlchemyOps (xem
  // GameManagerAlchemyOps.ts, task 3 Ã¯Â¿Â½ GameManager split). CÃ¯Â¿Â½c method
  // du?i dÃ¯Â¿Â½y lÃ¯Â¿Â½ thin delegate GI? public API cho UI/composables/tests.
  // =========================

  getAlchemyRecipes(): AlchemyRecipe[] {
    return this.alchemyOps.getAlchemyRecipes()
  }

  getAlchemyRecipe(recipeId: string): AlchemyRecipe | undefined {
    return this.alchemyOps.getAlchemyRecipe(recipeId)
  }

  getAlchemyRoomLevel(): number {
    return this.alchemyOps.getAlchemyRoomLevel()
  }

  getAlchemyJobs(): ActiveAlchemyJob[] {
    return this.alchemyOps.getAlchemyJobs()
  }

  startAlchemyJob(
    recipeId: string,
    herbMaterialId: string,
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    return this.alchemyOps.startAlchemyJob(recipeId, herbMaterialId, player)
  }

  cancelAlchemyJob(jobId: string): boolean {
    return this.alchemyOps.cancelAlchemyJob(jobId)
  }

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
    return this.alchemyOps.previewAlchemyOutcome(recipeId, herbMaterialId, roomLevel)
  }

  // =========================
  // BATTLE
  // =========================

  spawnEnemy(template: Enemy): Enemy {
    return this.enemySystem.spawn(template)
  }

  startBattle(player: CombatEntity, enemy: Enemy) {
    const enemyEntity = enemyToCombatEntity(this.enemySystem.spawn(enemy))

    // Spawn placement (plan Ã‚Â§5.1) Ã¢â‚¬â€ row/column do resolver roll trong
    // queueEnemySpawn (Boss luÃƒÂ´n row 4); khÃƒÂ´ng cÃƒÂ²n gÃƒÂ¡n lane ngoÃƒÂ i.

    // Reset mÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»â€¹nh Ã¢â‚¬â€ startBattleWithPlayer() sÃ¡ÂºÂ½ set lÃ¡ÂºÂ¡i session
    // (receiver/player) thÃ¡ÂºÂ­t ngay sau lÃ¡Â»â€¡nh gÃ¡Â»Âi nÃƒÂ y. Battle bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u qua
    // startBattle() trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p (khÃƒÂ´ng phÃ¡ÂºÂ£i PlayerData) thÃƒÂ¬ khÃƒÂ´ng cÃƒÂ³ ai
    // nhÃ¡ÂºÂ­n thÃ†Â°Ã¡Â»Å¸ng hay Ã„â€˜Ã¡Â»â€œ rÃ†Â¡i (equipment cÃ¡ÂºÂ§n player Ã„â€˜Ã¡Â»Æ’ roll chÃ¡Â»â€° sÃ¡Â»â€˜ chÃƒÂ­nh).
    // Stack passive (vd Linh KhÃƒÂ­ CÃ¡ÂºÂ£m Ã¡Â»Â¨ng +cÃƒÂ´ng kÃƒÂ­ch/Ã„â€˜ÃƒÂ²n trÃƒÂºng) lÃƒÂ 
    // buff TRONG TRÃ¡ÂºÂ¬N Ã¢â‚¬â€ reset vÃ¡Â»Â 0 mÃ¡Â»â€”i khi 1 trÃ¡ÂºÂ­n mÃ¡Â»â€ºi bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u, kÃ¡Â»Æ’ cÃ¡ÂºÂ£
    // khi Auto tÃ¡Â»Â± nÃ¡Â»â€˜i trÃ¡ÂºÂ­n ngay lÃ¡ÂºÂ­p tÃ¡Â»Â©c (theo yÃƒÂªu cÃ¡ÂºÂ§u, khÃƒÂ¡c thiÃ¡ÂºÂ¿t kÃ¡ÂºÂ¿
    // permanent progression ban Ã„â€˜Ã¡ÂºÂ§u).
    this.battleLoot.beginBattle()
    this.passiveSystem.resetStacks()

    // BÃ¡ÂºÂ¥t TÃ¡Â»Â­ ThÃ¡Â»Æ’ Ã¢â‚¬â€ reset mÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»â€¹nh vÃ¡Â»Â KHÃƒâ€NG bÃ¡ÂºÂ£o vÃ¡Â»â€¡; startBattleWithPlayer()
    // sÃ¡ÂºÂ½ set lÃ¡ÂºÂ¡i session thÃ¡ÂºÂ­t ngay sau (cÃƒÂ¹ng pattern battleLoot.setSession()).
    // TrÃ¡ÂºÂ­n startBattle() trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p (khÃƒÂ´ng PlayerData) thÃƒÂ¬ khÃƒÂ´ng cÃƒÂ³ thiÃƒÂªn phÃƒÂº.
    this.combatSystem.setSurviveLethalSession(null)

    this.battleSystem.start(player, enemyEntity)

    // Slice 6 cutover: d?ng d?ng th?i TurnBattle Ã¯Â¿Â½ engine turn-based ch?y
    // SONG SONG v?i real-time battle (v?n lÃ¯Â¿Â½ ngu?n s? th?t cho cÃ¯Â¿Â½c consumer
    // n?i b? chua flip). resolveNextStep() drive qua updateBattleFixedStep.
    this.turnBattle = this.buildTurnBattle(player, [enemyEntity])
  }

  /**
   * Ch?n basic attack theo cultivation path c?a player (Completion Task 5
   * mapping Ã¯Â¿Â½ 8 builds). Chua ch?n d?o/Th? Tu = generic physical.
   */
  private resolvePlayerBasicAttack(player: PlayerData): TurnSkillDefinition {
    if (player.cultivationPath === 'kiem_tu') {
      return BASIC_ATTACKS_BY_BUILD.kiem_tu!
    }

    if (player.cultivationPath === 'phap_tu') {
      const element = this.getPhapTuThuanElement() ?? 'fire'
      return BASIC_ATTACKS_BY_BUILD[`phap_tu_${element}`] ?? GENERIC_PHYSICAL_BASIC
    }

    return GENERIC_PHYSICAL_BASIC
  }

  private buildTurnBattle(playerEntity: CombatEntity, enemyEntities: CombatEntity[]): TurnBattle {
    const playerPath = this.activePlayer

    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
    )

    // Spawn placement (unified flow: Spawn Ã„â€˜Ã¡Â»Â©ng yÃƒÂªn tÃ¡ÂºÂ¡i vÃ¡Â»â€¹ trÃƒÂ­ resolve Ã¢â‚¬â€
    // khÃƒÂ´ng di chuyÃ¡Â»Æ’n) Ã¢â‚¬â€ tÃƒÂ¡i dÃƒÂ¹ng Ã„â€˜ÃƒÂºng resolveEnemySpawnPosition cÃ¡Â»Â§a hÃ¡Â»â€¡
    // sÃ¡Â»â€˜ng: Boss luÃƒÂ´n HERO_LANE (row 4), thÃ†Â°Ã¡Â»Âng random [0, GRID_ROW_COUNT),
    // column cÃ¡Â»â„¢t 7-15 (spawn tÃ¡Â»Â« mÃƒÂ©p phÃ¡ÂºÂ£i).
    const enemyParticipants = enemyEntities.map((enemyEntity, index) => {
      const position = resolveEnemySpawnPosition({
        isBoss: enemyEntity.isBoss ?? false,
        random: Math.random,
      })

      enemyEntity.row = position.row
      enemyEntity.x = position.column

      return toTurnBattleParticipant(enemyEntity, index + 1, GENERIC_PHYSICAL_BASIC)
    })

    return {
      players: [playerParticipant],
      enemies: enemyParticipants,
      state: 'countdown',
      // 3s countdown hÃ¡Â»â€¡ sÃ¡Â»â€˜ng Ã¢â€ â€™ 30 pacing ticks (BATTLE_FIXED_STEP 0.1s).
      countdownTurnsRemaining: 30,
      totalTurnsElapsed: 0,
    }
  }

  /** Tr?ng thÃ¯Â¿Â½i turn-based hi?n t?i Ã¯Â¿Â½ consumer n?i b? flip d?n sang dÃ¯Â¿Â½y. */
  /**
   * Auto-repeat cycle (Completion Task 8): dÃ¡Â»Â±ng TurnBattle mÃ¡Â»â€ºi sau victory
   * khi repeatContinuously bÃ¡ÂºÂ­t Ã¢â‚¬â€ giÃ¡Â»Â¯ player participant (HP/resource giÃ¡Â»Â¯
   * nguyÃƒÂªn nhÃ†Â° hÃ¡Â»â€¡ sÃ¡Â»â€˜ng restartCycle), enemies mÃ¡Â»â€ºi qua spawnEnemy factory.
   */
  private restartTurnBattleCycle() {
    const previous = this.turnBattle

    if (!previous || !this.activeStageForTurnBattle) {
      return
    }

    const stageRef = this.activeStageForTurnBattle

    this.turnBattleRewardsGranted.clear()
    this.turnBattleEndEmitted = false
    this.awaitedManualActor = null

    this.turnBattle = {
      players: previous.players,
      enemies: [],
      // Auto-repeat cycle giÃ¡Â»Â¯a stage KHÃƒâ€NG countdown lÃ¡ÂºÂ¡i (countdown chÃ¡Â»â€° Ã¡Â»Å¸
      // Ã„â€˜Ã¡ÂºÂ§u trÃ¡ÂºÂ­n/bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u stage Ã¢â‚¬â€ hÃ¡Â»â€¡ sÃ¡Â»â€˜ng restartCycle giÃ¡Â»Â¯ fighting ngay).
      state: 'fighting',
      totalTurnsElapsed: 0,
      wave: { totalEnemyCount: stageRef.totalEnemyCount, spawnedCount: 0 },
    }

    this.turnBattleSystem = new TurnBattleSystem(
      this.combatSystem,
      10_000,
      undefined,
      () => {
        const isFinalSpawn = (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= stageRef.totalEnemyCount
        const template =
          this.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn) ??
          this.lastStageEnemyTemplate

        if (!template) {
          throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
        }

        this.lastStageEnemyTemplate = template

        return toTurnBattleParticipant(
          enemyToCombatEntity(this.enemySystem.spawn(template)),
          this.turnBattle?.enemies.length ?? 0,
          GENERIC_PHYSICAL_BASIC,
        )
      },
    )
  }

  getTurnBattle(): TurnBattle | null {
    return this.turnBattle
  }

  // --- Slice 7 (Completion Task 10) Ã¢â‚¬â€ manual mode --------------------------

  private battleManualMode = false

  /**
   * Actor phe player Ã„â€˜ang bÃ¡Â»â€¹ PAUSE chÃ¡Â»Â manual choice (manual mode), hoÃ¡ÂºÂ·c
   * null khi khÃƒÂ´ng pause (auto mode, lÃ†Â°Ã¡Â»Â£t enemy, hoÃ¡ÂºÂ·c chÃ†Â°a tÃ¡Â»â€ºi lÃ†Â°Ã¡Â»Â£t).
   * Reset khi battle kÃ¡ÂºÂ¿t thÃƒÂºc/restart.
   */
  private awaitedManualActor: TurnBattleParticipant | null = null

  /** BÃ¡ÂºÂ­t/tÃ¡ÂºÂ¯t manual mode. TÃ¡ÂºÂ¯t giÃ¡Â»Â¯a lÃƒÂºc Ã„â€˜ang chÃ¡Â»Â choice Ã¢â€ â€™ hÃ¡Â»Â§y pause, engine tÃ¡Â»Â± chÃ¡ÂºÂ¡y tiÃ¡ÂºÂ¿p. */
  setBattleManualMode(enabled: boolean): void {
    this.battleManualMode = enabled

    if (!enabled) {
      this.awaitedManualActor = null
    }
  }

  isBattleManualMode(): boolean {
    return this.battleManualMode
  }

  /** Ã„Âang pause chÃ¡Â»Â player chÃ¡Â»Ân skill cho lÃ†Â°Ã¡Â»Â£t cÃ¡Â»Â§a chÃƒÂ­nh mÃƒÂ¬nh? */
  isAwaitingManualTurnChoice(): boolean
  {
    return this.awaitedManualActor !== null
  }

  /**
   * UI submit choice cho lÃ†Â°Ã¡Â»Â£t Ã„â€˜ang pause. TrÃ¡ÂºÂ£ false nÃ¡ÂºÂ¿u khÃƒÂ´ng cÃƒÂ³ pause
   * (no-op an toÃƒÂ n Ã¢â‚¬â€ choice bÃ¡Â»â€¹ bÃ¡Â»Â, khÃƒÂ´ng crash).
   */
  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    if (!this.awaitedManualActor || !this.turnBattle) {
      return false
    }

    const actor = this.awaitedManualActor
    this.awaitedManualActor = null

    this.turnBattleSystem.resolveActorTurn(this.turnBattle, actor, role)

    this.syncLegacyBattleState()

    return true
  }

  /**
   * DÃƒÂ nh cho UI: id cÃ¡Â»Â§a actor Ã„â€˜ang pause (luÃƒÂ´n lÃƒÂ  'player' Ã¡Â»Å¸ engine hiÃ¡Â»â€¡n
   * tÃ¡ÂºÂ¡i Ã¢â‚¬â€ party nhiÃ¡Â»Âu ngÃ†Â°Ã¡Â»Âi lÃƒÂ  redesign tÃ†Â°Ã†Â¡ng lai), null khi khÃƒÂ´ng pause.
   */
  consumeAwaitedActorId(): string | null {
    return this.awaitedManualActor?.id ?? null
  }

  /**
   * Slice 7 Ã¢â‚¬â€ presentation facade: buildTurnSkillPresentation cho trÃ¡ÂºÂ­n
   * turn hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (isPlayerTurnPaused = manual pause Ã„â€˜ang chÃ¡Â»Â choice).
   * Party (Task 10): khi pause, presentation theo PAUSED ACTOR (bÃ¡ÂºÂ¥t kÃ¡Â»Â³
   * party member nÃƒÂ o), khÃƒÂ´ng cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh players[0].
   */
  buildTurnSkillPresentation(
    battle: TurnBattle,
    isPlayerTurnPaused: boolean,
  ): {
    basic: TurnSkillPresentationEntry
    special: TurnSkillPresentationEntry
    ultimate: TurnSkillPresentationEntry
  } {
    return buildTurnSkillPresentation(
      battle,
      isPlayerTurnPaused,
      isPlayerTurnPaused ? (this.awaitedManualActor ?? undefined) : undefined,
    )
  }

  getBattleRewardSummary(): BattleRewardSummary {
    return this.battleLoot.getSummary()
  }

  /**
   * TiÃ¡Â»â€¡n ÃƒÂ­ch: bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u trÃ¡ÂºÂ­n Ã„â€˜Ã¡ÂºÂ¥u thÃ¡ÂºÂ³ng tÃ¡Â»Â« PlayerData thay vÃƒÂ¬ phÃ¡ÂºÂ£i
   * tÃ¡Â»Â± convert sang CombatEntity trÃ†Â°Ã¡Â»â€ºc. `playerStats` truyÃ¡Â»Ân vÃƒÂ o
   * phÃ¡ÂºÂ£i lÃƒÂ  finalStats (Ã„â€˜ÃƒÂ£ cÃ¡Â»â„¢ng modifiers) Ã¢â‚¬â€ lÃ¡ÂºÂ¥y tÃ¡Â»Â«
   * player store getter `finalStats`, khÃƒÂ´ng tÃƒÂ­nh lÃ¡ÂºÂ¡i Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y Ã„â€˜Ã¡Â»Æ’
   * trÃƒÂ¡nh 2 nÃ†Â¡i tÃ¡Â»Â± gÃ¡Â»Âi calculateStats() khÃƒÂ¡c nhau.
   */
  startBattleWithPlayer(player: PlayerData, playerStats: Stats, enemy: Enemy) {
    // DESIGN: mÃ¡Â»Âi chÃ¡Â»â€° sÃ¡Â»â€˜ combat, gÃ¡Â»â€œm skill runtime stats, Ã„â€˜Ã†Â°Ã¡Â»Â£c snapshot lÃƒÂºc
    // bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u trÃ¡ÂºÂ­n. Mua node/Ã„â€˜Ã¡Â»â€¢i trang bÃ¡Â»â€¹/loadout giÃ¡Â»Â¯a trÃ¡ÂºÂ­n chÃ¡Â»â€° cÃƒÂ³ hiÃ¡Â»â€¡u lÃ¡Â»Â±c tÃ¡Â»Â«
    // trÃ¡ÂºÂ­n kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p; khÃƒÂ´ng Ã„â€˜Ã¡Â»Â¥ng tÃ¡Â»â€ºi CombatEntity Ã„â€˜ang chiÃ¡ÂºÂ¿n Ã„â€˜Ã¡ÂºÂ¥u.
    //
    // Runtime authority (2026-08-24, plan Ã‚Â§5.4): `playerStats` lÃƒÂ  snapshot
    // TÃ„Â¨NH (getAggregatedModifiers chÃ¡Â»â€° trÃ¡ÂºÂ£ static Ã¢â‚¬â€ runtime khÃƒÂ´ng nÃ¡ÂºÂ±m Ã¡Â»Å¸
    // Ã„â€˜ÃƒÂ³); timed effect + socket modifier chÃ¡ÂºÂ£y vÃƒÂ o combat qua provider
    // MÃ¡Â»â€“I TICK (updateStatsFromModifiers) Ã¢â€ â€™ effect hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n giÃ¡Â»Â¯a trÃ¡ÂºÂ­n tÃ¡Â»Â±
    // trÃ¡Â»Å¸ vÃ¡Â»Â baseline, khÃƒÂ´ng double-apply, khÃƒÂ´ng Ã„â€˜ÃƒÂ³ng bÃ„Æ’ng trong baseStats.
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

    // BÃ¡ÂºÂ¥t TÃ¡Â»Â­ ThÃ¡Â»Æ’ (talent-direction-choice-plan Ã‚Â§6) Ã¢â‚¬â€ reset lÃ†Â°Ã¡Â»Â£t sÃ¡Â»â€˜ng sÃƒÂ³t
    // theo thiÃƒÂªn phÃƒÂº cÃ¡Â»Â§a player mÃ¡Â»â€”i trÃ¡ÂºÂ­n MÃ¡Â»Å¡I rÃ¡Â»â€œi gÃ¡ÂºÂ¯n session cho
    // combatSystem.killIfDead(). playerEntity.id lÃƒÂ  'player' (xem
    // playerToCombatEntity()).
    this.surviveLethalGuard.beginBattle(player.selectedTalentIds)
    this.combatSystem.setSurviveLethalSession({
      playerEntityId: playerEntity.id,
      guard: this.surviveLethalGuard,
      // v4 (spec 2026-09-03 Ã¯Â¿Â½4.1) Ã¯Â¿Â½ B?t T? Th th?: t?y debuff + T?
      // Sinh Ng? khi guard c?u s?ng. BuffSystem b?c pool c?a PLAYER
      // trong tr?n nÃ¯Â¿Â½y (getBuffSystem dÃ¯Â¿Â½ cÃ¯Â¿Â½ c?a BattleSystem cÃ¯Â¿Â½ng pool
      // Ã¯Â¿Â½ t? d?ng d? khÃ¯Â¿Â½ng l? internal map).
      surviveEffects: {
        buffSystem: new BuffSystem(this.battleSystem.getPlayerBuffs() ?? new BuffPool()),
        registry: this.buffRegistry,
      },
    })

    // BÃ¡ÂºÂ£n MÃ¡Â»â€¡nh PhÃƒÂ¡p BÃ¡ÂºÂ£o Ã¢â‚¬â€ snapshot level/grade/path/equippedElements
    // NGAY lÃƒÂºc trÃ¡ÂºÂ­n bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u (doc Ã‚Â§11); undefined nÃ¡ÂºÂ¿u player khÃƒÂ´ng cÃƒÂ³
    // artifact (KiÃ¡ÂºÂ¿m Tu/chÃ†Â°a TrÃƒÂºc CÃ†Â¡) Ã¢â‚¬â€ updateArtifactActivation() tÃ¡Â»Â±
    // no-op trong trÃ†Â°Ã¡Â»Âng hÃ¡Â»Â£p Ã„â€˜ÃƒÂ³.
    this.battleSystem.setArtifactRuntime(
      player.artifact
        ? createArtifactRuntime(
            player.artifact,
            filterNguHanhElements(player.equippedElements),
            playerEntity.currentWard,
          )
        : undefined,
    )

    // PhÃ¯Â¿Â½p Tu Thu?n H? (Task 12, spec Ã¯Â¿Â½7) Ã¯Â¿Â½ gate chu?i A?B?C?D?E cho
    // PhÃ¯Â¿Â½p Tu dÃ¯Â¿Â½ L?p Ã¯Â¿Â½?o Thu?n: setChainDefinition theo hÃ¯Â¿Â½nh d?c t? node
    // lap_dao_thuan_<el> (d?c LIVE, cÃ¯Â¿Â½ng ngu?n v?i closure ult).
    // undefined = khÃ¯Â¿Â½ng gate (m?i path cu/Ki?m Tu/guest gi? nguyÃ¯Â¿Â½n).
    // Session-scoped: chain lÃ¯Â¿Â½ state c?a BattleSystem (s?ng qua stop()),
    // set M?I l?n start d? tr?n k? khÃ¯Â¿Â½ng th?a hu?ng definition c?a player
    // tru?c (multi-player session).
    const thuanElement =
      player.cultivationPath === 'phap_tu' ? this.getPhapTuThuanElement() : undefined

    this.battleSystem.setChainDefinition(
      thuanElement ? { skillIds: [...CHAIN_SKILL_IDS[thuanElement]] } : undefined,
    )

  }

  /**
   * Slice 6 cutover (unified flow): getBattle() trÃ¡ÂºÂ£ TurnBattle khi cÃƒÂ³ trÃ¡ÂºÂ­n
   * turn-based Ã¢â‚¬â€ lÃƒÂ  NGUÃ¡Â»â€™N SÃ¡Â»Â° THÃ¡ÂºÂ¬T DUY NHÃ¡ÂºÂ¤T cho mÃ¡Â»Âi consumer (tests + 7 UI
   * sites). Shape TurnBattle cÃƒÂ³ `state` ('countdown' khÃ¡Â»â€ºp isBattleInProgress
   * hÃ¡Â»â€¡ sÃ¡Â»â€˜ng), `player`, `enemies[]` Ã¢â‚¬â€ Ã„â€˜Ã¡Â»Â§ cho read-only consumers.
   * Legacy Battle (real-time) chÃ¡Â»â€° trÃ¡ÂºÂ£ khi KHÃƒâ€NG cÃƒÂ³ turnBattle (tribulation
   * side chÃ†Â°a cutover).
   */
  getBattle(): Battle | null {
    if (this.turnBattle) {
      return this.turnBattle as unknown as Battle
    }

    return this.battleSystem.getBattle()
  }

  /**
   * RewardReceiver dÃƒÂ¹ng chung cho mÃ¡Â»Âi nÃ†Â¡i cÃ¡ÂºÂ¥p Reward trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p cho
   * player (battle victory, claim quest...) Ã¢â‚¬â€ insight Ã„â€˜Ã¡Â»â€¢ vÃƒÂ o tÃƒÂ¢m phÃƒÂ¡p
   * Ã„â€˜ang trang bÃ¡Â»â€¹, Linh ThÃ¡ÂºÂ¡ch Ã„â€˜Ã¡Â»â€¢ vÃƒÂ o MaterialBag (Plan Workstream F).
   */
  private buildPlayerRewardReceiver(player: PlayerData): RewardReceiver {
    return createPlayerRewardReceiver(
      player,
      (amount) => this.gainEquippedTechniqueInsight(amount),
      (amount) => {
        // CÃ¡ÂºÂ¥p Ã„ÂÃƒÅ¡NG phÃ¡ÂºÂ©m Linh ThÃ¡ÂºÂ¡ch theo cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (khÃ¡Â»â€ºp phÃ¡ÂºÂ©m mÃƒÂ 
        // chi phÃƒÂ­ Ã„ÂÃ¡Â»â„¢t PhÃƒÂ¡/CÃ†Â°Ã¡Â»Âng HÃƒÂ³a/nÃƒÂ¢ng cÃ¡ÂºÂ¥p cÃƒÂ´ng trÃƒÂ¬nh Ã„â€˜ÃƒÂ²i hÃ¡Â»Âi Ã¡Â»Å¸ cÃ¡ÂºÂ£nh
        // giÃ¡Â»â€ºi Ã„â€˜ÃƒÂ³) Ã¢â‚¬â€ khÃƒÂ´ng cÃ¡ÂºÂ¥p cÃ¡Â»Â©ng HÃ¡ÂºÂ¡ PhÃ¡ÂºÂ©m khiÃ¡ÂºÂ¿n ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i cÃ¡ÂºÂ£nh giÃ¡Â»â€ºi
        // cao kÃ¡ÂºÂ¹t lÃ¡ÂºÂ¡i vÃƒÂ¬ cÃƒÂ³ Linh ThÃ¡ÂºÂ¡ch nhÃ†Â°ng sai phÃ¡ÂºÂ©m.
        const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

        if (amount > 0 && this.materialRegistry.has(spiritStoneId)) {
          this.materialBag.add(this.materialRegistry.get(spiritStoneId), amount)

          this.notifyQuestMaterialGained(spiritStoneId, amount)
        }
      },
    )
  }

  // =========================
  // QUEST (NhiÃ¡Â»â€¡m VÃ¡Â»Â¥)
  // =========================

  // TÃ¯Â¿Â½ch kh?i GameManager (2026-09-03, task 4 Ã¯Â¿Â½ GameManager split) Ã¯Â¿Â½ logic
  // th?t n?m trong GameManagerQuestOps (xem GameManagerQuestOps.ts). CÃ¯Â¿Â½c
  // method du?i dÃ¯Â¿Â½y lÃ¯Â¿Â½ thin delegate GI? NGUYÃ¯Â¿Â½N public API d? call site
  // ngoÃ¯Â¿Â½i GameManager.ts (QuestPanel.vue...) khÃ¯Â¿Â½ng ph?i d?i.
  private notifyQuestMaterialGained(materialId: string, amount: number): void {
    this.questOps.notifyQuestMaterialGained(materialId, amount)
  }

  getActiveQuests(): { quest: Quest; progress: QuestProgress }[] {
    return this.questOps.getActiveQuests()
  }

  canClaimQuest(questId: string): boolean {
    return this.questOps.canClaimQuest(questId)
  }

  claimQuest(questId: string): boolean {
    return this.questOps.claimQuest(questId)
  }

  // gainEquippedTechniqueInsight() sits inside the // QUEST comment block
  // (task 4 brief scope) but is unrelated to quests Ã¯Â¿Â½ it advances PhÃ¯Â¿Â½p Tu
  // technique insight, used by buildPlayerRewardReceiver() below (battle
  // victory + quest claim rewards alike). Left in place, same pattern as
  // task 2's getEnemyTemplate() finding.
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

    * Ã¯Â¿Â½? Ki?p (spec dot-pha-loi-kiep Ã¯Â¿Â½5.1) Ã¯Â¿Â½ delegate xu?ng
    * TribulationDirector (runtime chuong ki?p m?i: tÃ¯Â¿Â½m ma + tank lÃ¯Â¿Â½i,
    * KHÃ¯Â¿Â½NG qua BattleSystem, khÃ¯Â¿Â½ng quÃ¯Â¿Â½i Ki?p). hasTrucCoDan d?c t?
    * PillBag (v?t ch?ng b?c Ã¯Â¿Â½?a/ThiÃ¯Â¿Â½n, khÃ¯Â¿Â½ng tiÃ¯Â¿Â½u). B?t T? Th? khÃ¯Â¿Â½ng Ã¯Â¿Â½p
    * trong ki?p (nghi l? th?t Ã¯Â¿Â½ gi? pattern cu): ki?p khÃ¯Â¿Â½ng qua combat
    * nÃ¯Â¿Â½n khÃ¯Â¿Â½ng cÃ¯Â¿Â½ session nÃ¯Â¿Â½o d? xoÃ¯Â¿Â½.
    */

  startTribulation(
    player: PlayerData,
    playerStats: Stats,
    targetRealmId: string,
  ): boolean {
    const hasTrucCoDan = this.pillBag.has('truc_co_dan', 1)

    return this.tribulationDirector.start(player, playerStats, hasTrucCoDan, targetRealmId)
  }


  /** Tr? l?i cÃ¯Â¿Â½u h?i tÃ¯Â¿Â½m ma hi?n t?i (overlay Vue g?i qua facade nÃ¯Â¿Â½y). */
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
   * ÃƒÂp 1 buff/debuff PERSISTENT (ngoÃƒÂ i trÃ¡ÂºÂ­n) lÃƒÂªn player Ã¢â‚¬â€ dÃƒÂ¹ng cho
   * KiÃ¡ÂºÂ¿p ThÃ†Â°Ã†Â¡ng khi thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i Ã„ÂÃ¡Â»â„¢ KiÃ¡ÂºÂ¿p (mÃ¡Â»Â¥c 13 spec `breakthrough`).
   * CÃƒÂ¹ng buffSystem/buffManager nuÃƒÂ´i getAggregatedModifiers() mÃ¡Â»â€”i
   * tick (xem PillSystem's effect 'buff' Ã¢â‚¬â€ cÃƒÂ¹ng cÃ†Â¡ chÃ¡ÂºÂ¿).
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
   * NgÃ†Â°Ã¡Â»Âi chÃ†Â¡i CHÃ¡Â»Â¦ Ã„ÂÃ¡Â»ËœNG thoÃƒÂ¡t trÃ¡ÂºÂ­n giÃ¡Â»Â¯a chÃ¡Â»Â«ng (nÃƒÂºt "ThoÃƒÂ¡t TrÃ¡ÂºÂ­n" Ã¡Â»Å¸
   * CombatControlBar.vue, cÃƒÂ³ xÃƒÂ¡c nhÃ¡ÂºÂ­n trÃ†Â°Ã¡Â»â€ºc khi gÃ¡Â»Âi tÃ¡Â»â€ºi Ã„â€˜ÃƒÂ¢y) Ã¢â‚¬â€ TÃƒÂI
   * DÃƒâ„¢NG luÃ¡Â»â€œng 'defeat' sÃ¡ÂºÂµn cÃƒÂ³ thay vÃƒÂ¬ dÃ¡Â»Â±ng 1 BattleState/UI mÃ¡Â»â€ºi:
   * chÃ¡Â»â€° set battle.state + emit 'battle_end' giÃ¡Â»â€˜ng hÃ¡Â»â€¡t
   * BattleSystem.checkBattleEnd() lÃƒÂ m khi player chÃ¡ÂºÂ¿t.
   * updateStageProgress() TÃ¡Â»Â° dÃ¡Â»Â«ng stageManager Ã¡Â»Å¸ tick kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p khi thÃ¡ÂºÂ¥y
   * state 'defeat' (xem ghi chÃƒÂº Ã¡Â»Å¸ Ã„â€˜ÃƒÂ³) Ã¢â‚¬â€ khÃƒÂ´ng cÃ¡ÂºÂ§n tÃ¡Â»Â± dÃ¡Â»Ân gÃƒÂ¬ thÃƒÂªm Ã¡Â»Å¸
   * Ã„â€˜ÃƒÂ¢y. PhÃ¡ÂºÂ§n thÃ†Â°Ã¡Â»Å¸ng Ã„â€˜ÃƒÂ£ kiÃ¡ÂºÂ¿m Ã„â€˜Ã†Â°Ã¡Â»Â£c (grantBattleRewardIfNeeded() chÃ¡ÂºÂ¡y
   * MÃ¡Â»â€“I TICK theo tÃ¡Â»Â«ng quÃƒÂ¡i chÃ¡ÂºÂ¿t, khÃƒÂ´ng Ã„â€˜Ã¡Â»Â£i tÃ¡Â»â€ºi cuÃ¡Â»â€˜i trÃ¡ÂºÂ­n) KHÃƒâ€NG mÃ¡ÂºÂ¥t
   * dÃƒÂ¹ thoÃƒÂ¡t giÃ¡Â»Â¯a chÃ¡Â»Â«ng. ChÃ¡Â»â€° ÃƒÂ¡p dÃ¡Â»Â¥ng trÃ¡ÂºÂ­n Stage Ã¢â‚¬â€ Tribulation (Ã„ÂÃ¡Â»â„¢t
   * PhÃƒÂ¡) cÃƒÂ³ luÃ¡Â»â€œng thÃ¡ÂºÂ¯ng/thua RIÃƒÅ NG (useTribulation.ts), nÃƒÂºt "ThoÃƒÂ¡t
   * TrÃ¡ÂºÂ­n" khÃƒÂ´ng hiÃ¡Â»â€¡n trong trÃ¡ÂºÂ­n Ã„â€˜ÃƒÂ³ (xem CombatControlBar.vue).
   */
  abandonBattle(): boolean {
    // Slice 6 cutover: TurnBattle lÃ¯Â¿Â½ ngu?n s? th?t cho "tr?n dang ch?y".
    const turnActive = !!this.turnBattle && this.turnBattle.state === 'fighting'

    const battle = this.battleSystem.getBattle()

    if (!turnActive && (!battle || (battle.state !== 'countdown' && battle.state !== 'fighting'))) {
      return false
    }

    if (this.turnBattle) {
      this.turnBattle.state = 'defeat'
    }

    if (battle) {
      battle.state = 'defeat'
    }
    this.stageWaves.stopRepeat()

    this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })

    // Audit fix 2026-08-31 Ã¯Â¿Â½ enemy s?ng + pending spawn c?a tr?n b? b? khÃ¯Â¿Â½ng
    // qua victory flow (processDefeatedEnemies despawn) ? orphan vinh vi?n
    // trong EnemyManager. Clear ? Ã¯Â¿Â½Ã¯Â¿Â½NG di?m h?y tr?n, khÃ¯Â¿Â½ng d?ng flow victory
    // (StageWave auto-repeat spawn tr?n m?i ngay sau victory).
    this.enemyManager.clear()

    return true
  }

  // =========================
  // STAGE (wave spawn)
  // =========================
  // VÃƒÂ²ng Ã„â€˜Ã¡Â»Âi wave (spawn nhÃ¡Â»â€¹p, victory, auto-repeat, boss summon) nÃ¡ÂºÂ±m Ã¡Â»Å¸
  // StageWaveSystem Ã¢â‚¬â€ cÃƒÂ¡c method dÃ†Â°Ã¡Â»â€ºi Ã„â€˜ÃƒÂ¢y lÃƒÂ  delegate giÃ¡Â»Â¯ public API.

  startStage(
    player: PlayerData,
    playerStats: Stats,
    stage: Stage,
    repeatContinuously = false,
  ): boolean {
    const started = this.stageWaves.start(player, playerStats, stage, repeatContinuously)

    if (!started) {
      return false
    }

    this.turnBattleRepeatContinuously = repeatContinuously
    this.activeStageForTurnBattle = stage
    this.playerDataForTurnBattle = player
    this.playerStatsForTurnBattle = playerStats

    // Slice 6 cutover (Completion Task 8): stage chÃ¡ÂºÂ¡y trÃƒÂªn TurnBattle Ã¢â‚¬â€
    // wave config (Slice 5) + spawnEnemy factory wrap pickEnemyForSpawn
    // (spec Ã‚Â§5.3 thin adapter). Enemy Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn Ã„â€˜ÃƒÂ£ spawn qua launchBattle
    // Ã¢â€ â€™ startBattle Ã¢â€ â€™ buildTurnBattle; bÃ¡Â»â€¢ sung wave state vÃƒÂ o TurnBattle.
    if (this.turnBattle) {
      // Auto-farm spec Task 3 Ã¢â‚¬â€ mÃ¡Â»â€˜c wall-clock bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u stage (clearSeconds).
      this.turnBattleStartedAtMs = Date.now()

      this.turnBattle.wave = {
        totalEnemyCount: stage.totalEnemyCount,
        spawnedCount: 1,
      }

      const stageRef = stage

      this.turnBattleSystem = new TurnBattleSystem(
        this.combatSystem,
        10_000,
        undefined,
        () => {
          // isFinalSpawn: lÃ†Â°Ã¡Â»Â£t spawn cuÃ¡Â»â€˜i lÃƒÂ  boss (tÃ¡ÂºÂ§ng 10) Ã¢â‚¬â€ factory chÃ¡ÂºÂ¡y
          // TRÃ†Â¯Ã¡Â»Å¡C khi resolveNextStep tÃ„Æ’ng spawnedCount, nÃƒÂªn tÃ¡Â»â€¢ng Ã„â€˜ÃƒÂ£-spawn
          // sau lÃ¡ÂºÂ§n nÃƒÂ y = spawnedCount + 1.
          const isFinalSpawn = (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= stageRef.totalEnemyCount
          const template =
            this.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn) ??
            this.lastStageEnemyTemplate

          if (!template) {
            throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
          }

          this.lastStageEnemyTemplate = template

          return toTurnBattleParticipant(
            enemyToCombatEntity(this.enemySystem.spawn(template)),
            this.turnBattle?.enemies.length ?? 1,
            GENERIC_PHYSICAL_BASIC,
          )
        },
      )
    }

    return true
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
    this.saveRestore.preflightSaveRegistryReferences(save)
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
    return this.saveRestore.restoreFromSave(save)
  }

  // =========================
  // TICK
  // =========================

  /**
   * GÃ¡Â»Âi mÃ¡Â»â€”i tick tÃ¡Â»Â« game loop (App.vue) vÃ¡Â»â€ºi deltaSeconds Ã„â€˜o Ã„â€˜Ã†Â°Ã¡Â»Â£c
   * tÃ¡Â»Â« GameClock. GameManager chÃ¡Â»â€° forward xuÃ¡Â»â€˜ng cÃƒÂ¡c system cÃƒÂ³
   * trÃ¡ÂºÂ¡ng thÃƒÂ¡i phÃ¡Â»Â¥ thuÃ¡Â»â„¢c thÃ¡Â»Âi gian Ã¢â‚¬â€ khÃƒÂ´ng tÃ¡Â»Â± tÃƒÂ­nh thÃ¡Â»Âi gian.
   */
  update(deltaSeconds: number) {
    if (deltaSeconds <= 0) {
      return
    }

    // Timed effect theo thÃ¡Â»Âi gian thÃ¡Â»Â±c Ã¢â‚¬â€ tick expiry Ã¡Â»Å¸ MÃ¡Â»Å’I update (cÃ¡ÂºÂ£
    // khi pause battle) vÃƒÂ¬ deadline lÃƒÂ  Date.now() tuyÃ¡Â»â€¡t Ã„â€˜Ã¡Â»â€˜i, khÃƒÂ´ng dÃƒÂ¹ng
    // game delta kÃƒÂ©o dÃƒÂ i buff (plan Ã‚Â§5.4). Player reference do App.vue
    // Ã„â€˜Ã„Æ’ng kÃƒÂ½ qua setActivePlayer() sau boot/load.
    if (this.activePlayer) {
      this.tickTimedEffects(this.activePlayer)

      // Quest daily reset (Quest System plan) Ã¢â‚¬â€ wall-clock day-bucket,
      // check mÃ¡Â»â€”i tick nÃƒÂªn vÃ¡ÂºÂ«n reset kÃ¡Â»Æ’ cÃ¡ÂºÂ£ khi panel NhiÃ¡Â»â€¡m VÃ¡Â»Â¥ Ã„â€˜ang Ã„â€˜ÃƒÂ³ng.
      if (
        this.questSystem.checkAndResetDaily(
          this.questRegistry,
          this.questManager,
          this.activePlayer,
        )
      ) {
      this.notifications.push({ kind: 'craft', message: 'Nhi?m v? hÃ¯Â¿Â½ng ngÃ¯Â¿Â½y dÃ¯Â¿Â½ lÃ¯Â¿Â½m m?i' })
      }

      // Production settle (plan Ã‚Â§4.3) Ã¢â‚¬â€ delivery thÃ¡ÂºÂ³ng Bag khi cycle
      // hoÃƒÂ n thÃƒÂ nh; notification ghi rÃƒÂµ vÃ¡ÂºÂ­t liÃ¡Â»â€¡u + sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng (Ã‚Â§9.1).
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

        // Collect-quest hook (review 2026-08-28) Ã¢â‚¬â€ production settle lÃƒÂ 
        // nguÃ¡Â»â€œn material chÃƒÂ­nh cÃ¡Â»Â§a collect-quest. ChÃ¡Â»â€° tÃƒÂ­nh lÃ†Â°Ã¡Â»Â£ng thÃ¡ÂºÂ­t sÃ¡Â»Â±
        // vÃƒÂ o tÃƒÂºi (trÃ¡Â»Â« overflow).
        this.notifyQuestMaterialGained(event.materialId, event.amount - (event.overflow ?? 0))

        this.notifications.push({
          kind: 'loot',
          message: `${material?.name ?? event.materialId} Ã¯Â¿Â½${event.amount}`,
        })
      }

      // Ã„Âan PhÃƒÂ²ng settle (Ã‚Â§8.3). ThiÃƒÂªn phÃƒÂº Ã„Âan DuyÃƒÂªn cÃ¡Â»â„¢ng Ã„â€˜iÃ¡Â»Æ’m % thÃƒÂ nh
      // Ã„â€˜an (plan Ã‚Â§6) Ã¢â‚¬â€ Ã„â€˜Ã¡Â»Âc tÃ¡Â»Â« activePlayer mÃ¡Â»â€”i tick, Ã„â€˜Ã¡Â»â€¢i talent lÃƒÂ  cÃƒÂ³ hiÃ¡Â»â€¡u lÃ¡Â»Â±c.
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
            : `Luy?n ${pill?.name ?? event.pillId} th?t b?i`,
        })
      }

      // Task 14 (rework P4) Ã¯Â¿Â½ Tab PhÃ¯Â¿Â½n Gi?i cycle: khoÃ¯Â¿Â½ng ? tinh hoa.
      this.decomposeSystem.tick(Date.now())

      for (const entry of this.decomposeSystem.drainOutput()) {
        const tinhHoa = this.materialRegistry.has(entry.materialId)
          ? this.materialRegistry.get(entry.materialId)
          : undefined

        this.materialBag.add(tinhHoa ?? { id: entry.materialId, name: entry.materialId } as never, entry.amount)

        this.notifications.push({
          kind: 'craft',
          message: `PhÃ¯Â¿Â½n Gi?i +${entry.amount} ${(tinhHoa as { name?: string } | undefined)?.name ?? 'Tinh Hoa'}`,
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


    // Turn-based conversion (2026-09-04) Ã¯Â¿Â½ cooldownReduction retired;
    // SkillSystem (engine doomed) nh?n 0 thay vÃ¯Â¿Â½ d?c stat dÃ¯Â¿Â½ xÃ¯Â¿Â½a.
    this.skillSystem.update(deltaSeconds, 0)

    this.passiveSystem.tick(deltaSeconds)

    this.updateBattleFixedStep(deltaSeconds)
  }

  /**
   * Chia deltaSeconds thÃƒÂ nh cÃƒÂ¡c bÃ†Â°Ã¡Â»â€ºc cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh BATTLE_FIXED_STEP_SECONDS
   * cho nhÃƒÂ¡nh phÃ¡Â»Â¥ thuÃ¡Â»â„¢c timer-Ã„â€˜Ã¡ÂºÂ¿m-ngÃ†Â°Ã¡Â»Â£c-rÃ¡Â»â€œi-reset (Ã„â€˜ÃƒÂ²n Ã„â€˜ÃƒÂ¡nh, spawn
   * quÃƒÂ¡i, phÃ¡ÂºÂ§n thÃ†Â°Ã¡Â»Å¸ng) Ã¢â‚¬â€ xem ghi chÃƒÂº Ã¡Â»Å¸ BATTLE_FIXED_STEP_SECONDS phÃƒÂ­a
   * trÃƒÂªn. GiÃ¡Â»â€ºi hÃ¡ÂºÂ¡n Ã¡Â»Å¸ BATTLE_MAX_CATCHUP_SECONDS Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng lÃ¡ÂºÂ·p hÃƒÂ ng ngÃƒÂ n
   * bÃ†Â°Ã¡Â»â€ºc khi deltaSeconds bÃ¡ÂºÂ¥t thÃ†Â°Ã¡Â»Âng lÃ¡Â»â€ºn.
   *
   * updateTribulation()/updateTribulationProgress() CHÃ¡Â»Â¦ ÃƒÂ Ã„â€˜Ã¡Â»Â©ng NGOÃƒâ‚¬I
   * vÃƒÂ²ng lÃ¡ÂºÂ·p bÃ†Â°Ã¡Â»â€ºc nhÃ¡Â»Â: updateTribulation() Ã„â€˜ÃƒÂ£ tÃ¡Â»Â± cÃƒÂ³ vÃƒÂ²ng lÃ¡ÂºÂ·p catch-up
   * riÃƒÂªng (while nextStrikeInSeconds <= 0) hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng Ã„â€˜ÃƒÂºng vÃ¡Â»â€ºi deltaSeconds
   * lÃ¡Â»â€ºn dÃ¡ÂºÂ¡ng Ã„â€˜ÃƒÂ³ng (khÃƒÂ´ng tÃƒÂ­ch luÃ¡Â»Â¹ theo bÃ†Â°Ã¡Â»â€ºc), gÃ¡Â»Âi 1 lÃ¡ÂºÂ§n vÃ¡Â»â€ºi deltaSeconds
   * gÃ¡Â»â€˜c lÃƒÂ  chÃƒÂ­nh xÃƒÂ¡c. Chia nhÃ¡Â»Â nÃƒÂ³ thÃƒÂ nh hÃƒÂ ng trÃ„Æ’m bÃ†Â°Ã¡Â»â€ºc 0.1s sÃ¡ÂºÂ½ CÃ¡Â»ËœNG DÃ¡Â»â€™N
   * sai sÃ¡Â»â€˜ dÃ¡ÂºÂ¥u phÃ¡ÂºÂ©y Ã„â€˜Ã¡Â»â„¢ng (0.1 khÃƒÂ´ng biÃ¡Â»Æ’u diÃ¡Â»â€¦n chÃ¡ÂºÂµn nhÃ¡Â»â€¹ phÃƒÂ¢n) vÃƒÂ o
   * active.nextStrikeInSeconds, cÃƒÂ³ thÃ¡Â»Æ’ lÃƒÂ m lÃ¡Â»â€¡ch 1 lÃƒÂ´i kÃƒÂ­ch so vÃ¡Â»â€ºi thÃ¡ÂºÂ­t.
   */

  private updateBattleFixedStep(deltaSeconds: number) {
    let remaining = Math.min(deltaSeconds, BATTLE_MAX_CATCHUP_SECONDS)

    while (remaining > 0) {
      const step = Math.min(BATTLE_FIXED_STEP_SECONDS, remaining)

      remaining -= step

      // Slice 6 cutover Ã¢â‚¬â€ unified flow: Countdown Ã¢â€ â€™ Spawn (Ã„â€˜ÃƒÂ£ cÃƒÂ³ sÃ¡ÂºÂµn) Ã¢â€ â€™
      // Gauge combat Ã¢â€ â€™ Wave spawn khi sÃƒÂ¢n trÃ¡Â»â€˜ng Ã¢â€ â€™ Result khi hÃ¡ÂºÂ¿t wave.
      // MÃ¡Â»â€”i fixed step 0.1s = 1 pacing tick; turn resolution instant.
      if (this.turnBattle) {
        if (this.turnBattle.state === 'countdown') {
          this.turnBattleSystem.tickCountdown(this.turnBattle)
        } else if (this.turnBattle.state === 'fighting') {
          // Slice 7 manual mode: trÃ†Â°Ã¡Â»â€ºc khi resolve step kÃ¡ÂºÂ¿, peek actor Ã¢â‚¬â€
          // nÃ¡ÂºÂ¿u lÃƒÂ  player VÃƒâ‚¬ manual mode bÃ¡ÂºÂ­t Ã¢â€ â€™ PAUSE (khÃƒÂ´ng resolve, gauge
          // Ã„â€˜ÃƒÂ£ advance Ã„â€˜ÃƒÂºng tÃ¡Â»â€ºi ngÃ†Â°Ã¡Â»Â¡ng ready bÃ¡Â»Å¸i peek). Enemy turn vÃƒÂ  auto
          // mode resolve nhÃ†Â° thÃ†Â°Ã¡Â»Âng (auto = cÃƒÂ¹ng engine, khÃƒÂ´ng pause).
          if (this.awaitedManualActor) {
            // VÃ¡ÂºÂ«n Ã„â€˜ang pause Ã¢â‚¬â€ khÃƒÂ´ng resolve gÃƒÂ¬ (chÃ¡Â»Â submitTurnChoice).
          } else if (this.battleManualMode) {
            const actor = this.turnBattleSystem.peekNextActor(this.turnBattle)

            if (actor !== null && this.turnBattle.players.includes(actor)) {
              this.awaitedManualActor = actor
            } else if (actor !== null) {
              this.turnBattleSystem.resolveActorTurn(this.turnBattle, actor)
            }
          } else {
            this.turnBattleSystem.resolveNextStep(this.turnBattle)
          }
        }
      }

      this.syncLegacyBattleState()

      this.grantBattleRewardIfNeeded()
    }

    // Victory event cho stage/turn flow Ã¢â‚¬â€ emit Ã„ÂÃƒÅ¡NG 1 LÃ¡ÂºÂ¦N mÃ¡Â»â€”i cycle.
    if (
      this.turnBattle &&
      this.turnBattle.state === 'victory' &&
      !this.turnBattleEndEmitted
    ) {
      this.turnBattleEndEmitted = true
      this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })

      // Stage completion (StageWaveSystem.update cÃ…Â©): push completedStageIds
      // Ã„ÂÃƒÅ¡NG 1 LÃ¡ÂºÂ¦N Ã¢â‚¬â€ auto-repeat vÃ¡ÂºÂ«n push (player hoÃƒÂ n thÃƒÂ nh stage nÃƒÂ y dÃƒÂ¹
      // Ã„â€˜ÃƒÂ¡nh tiÃ¡ÂºÂ¿p cycle mÃ¡Â»â€ºi).
      if (
        this.playerDataForTurnBattle &&
        this.activeStageForTurnBattle &&
        !this.playerDataForTurnBattle.completedStageIds.includes(this.activeStageForTurnBattle.id)
      ) {
        this.playerDataForTurnBattle.completedStageIds.push(this.activeStageForTurnBattle.id)
      }

    }

    // Auto-repeat: victory + repeat bÃ¡ÂºÂ­t Ã¢â€ â€™ restart NGAY trong cÃƒÂ¹ng call
    // (khÃƒÂ´ng chÃ¡Â»Â step kÃ¡ÂºÂ¿) Ã„â€˜Ã¡Â»Æ’ getBattle()?.state quay lÃ¡ÂºÂ¡i countdown Ã¢â€ â€™
    // fighting tÃ¡Â»Â©c thÃƒÂ¬ sau khi rewards Ã„â€˜ÃƒÂ£ grant Ã¢â‚¬â€ khÃ¡Â»â€ºp semantics hÃ¡Â»â€¡ sÃ¡Â»â€˜ng
    // (StageWaveSystem restartCycle chÃ¡ÂºÂ¡y ngay trong cÃƒÂ¹ng tick victory).
    if (
      this.turnBattle &&
      this.turnBattle.state === 'victory' &&
      this.turnBattleRepeatContinuously &&
      this.activeStageForTurnBattle !== null &&
      this.stageManager.get() !== null
    ) {
      this.restartTurnBattleCycle()
    }

    // NgoÃƒÂ i vÃƒÂ²ng fixed-step Ã¢â‚¬â€ TribulationDirector tÃ¡Â»Â± cÃƒÂ³ catch-up dÃ¡ÂºÂ¡ng
    // Ã„â€˜ÃƒÂ³ng (spec dot-pha-loi-kiep Ã‚Â§5.6), chia nhÃ¡Â»Â sÃ¡ÂºÂ½ cÃ¡Â»â„¢ng dÃ¡Â»â€œn sai sÃ¡Â»â€˜ float.
    this.tribulationDirector.update(deltaSeconds)
  }
  private grantBattleRewardIfNeeded() {
    // Slice 6 cutover: rewards d?c t? TurnBattle (engine duy nh?t). Shim
    // Battle-shape { enemies: [{ entity, rewardGranted }], player } gi?
    // processDefeatedEnemies ho?t d?ng khÃ¯Â¿Â½ng c?n s?a BattleLootSystem.
    if (this.turnBattle) {
      this.grantTurnBattleRewards()
      return
    }

    const battle = this.battleSystem.getBattle()

    if (battle) {
      this.battleLoot.processDefeatedEnemies(battle)
    }
  }

  private turnBattleRewardsGranted = new Set<string>()

  private grantTurnBattleRewards() {
    const turnBattle = this.turnBattle

    if (!turnBattle) {
      return
    }

    const killedIds = turnBattle.enemies
      .filter((enemy) => !enemy.entity.alive && !this.turnBattleRewardsGranted.has(enemy.entity.id))
      .map((enemy) => enemy.entity.id)

    if (killedIds.length === 0 && turnBattle.state === 'fighting') {
      return
    }

    // Slice 6 cutover: dÃ¡Â»Â±ng shim Battle-shape tÃ¡Â»Â« TurnBattle Ã„â€˜Ã¡Â»Æ’
    // processDefeatedEnemies xÃ¡Â»Â­ lÃƒÂ½ bounty/heal-on-kill/talent Ã„â€˜ÃƒÂºng nhÃ†Â° hÃ¡Â»â€¡
    // cÃ…Â© mÃƒÂ  khÃƒÂ´ng sÃ¡Â»Â­a BattleLootSystem. rewardGranted flag shim-side.
    const shimEnemies = turnBattle.enemies.map((enemy) => ({
      entity: enemy.entity,
      rewardGranted: this.turnBattleRewardsGranted.has(enemy.entity.id),
    }))

    const shimBattle = {
        player: turnBattle.players[0]?.entity,
      enemies: shimEnemies,
    } as unknown as Battle

    this.battleLoot.processDefeatedEnemies(shimBattle)


    for (const enemyId of killedIds) {
      this.turnBattleRewardsGranted.add(enemyId)
    }

    // Victory/defeat terminal: bÃ¡ÂºÂ¯n battle_end (StageWaveSystem.update cÃ…Â©
    // khÃƒÂ´ng chÃ¡ÂºÂ¡y nÃ¡Â»Â¯a Ã¢â‚¬â€ syncLegacyBattleState() set legacy.state trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p
    // khiÃ¡ÂºÂ¿n update() return sÃ¡Â»â€ºm trÃ†Â°Ã¡Â»â€ºc victory branch). StageManager.active
    // PHÃ¡ÂºÂ¢I Ã„â€˜Ã†Â°Ã¡Â»Â£c release tÃ¡ÂºÂ¡i Ã„â€˜ÃƒÂ¢y: nÃ¡ÂºÂ¿u khÃƒÂ´ng, startStage() kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p (Ã„ÂÃƒÂ¡nh LÃ¡ÂºÂ¡i)
    // return false vÃ„Â©nh viÃ¡Â»â€¦n trong session (smoke-test regression 2026-09-04).
    // Auto-repeat KHÃƒâ€NG stop Ã¢â‚¬â€ restartTurnBattleCycle tÃƒÂ¡i dÃƒÂ¹ng active.
    if (turnBattle.state !== 'fighting' && !this.turnBattleEndEmitted) {
      this.turnBattleEndEmitted = true

      if (!this.turnBattleRepeatContinuously) {
        this.stageWaves.stopRepeat()
      }

      if (turnBattle.state === 'victory') {
        this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })

        this.recordPerfectClearIfEligible(turnBattle)

        // Stage completion (StageWaveSystem.update cÃ…Â©): push completedStageIds
        // Ã„ÂÃƒÅ¡NG 1 LÃ¡ÂºÂ¦N mÃ¡Â»â€”i stage Ã¢â‚¬â€ auto-repeat vÃ¡ÂºÂ«n push (player hoÃƒÂ n thÃƒÂ nh
        // stage nÃƒÂ y dÃƒÂ¹ Ã„â€˜ÃƒÂ¡nh tiÃ¡ÂºÂ¿p cycle mÃ¡Â»â€ºi).
        if (
          this.playerDataForTurnBattle &&
          this.activeStageForTurnBattle &&
          !this.playerDataForTurnBattle.completedStageIds.includes(this.activeStageForTurnBattle.id)
        ) {
          this.playerDataForTurnBattle.completedStageIds.push(this.activeStageForTurnBattle.id)
        }
      }
    }
  }

  private turnBattleEndEmitted = false

  /** Auto-farm spec Task 3 Ã¢â‚¬â€ wall-clock timestamp lÃƒÂºc bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u stage (chuÃ¡ÂºÂ©n hoÃƒÂ¡ clearSeconds cho HoÃƒÂ n MÃ¡Â»Â¹). */
  private turnBattleStartedAtMs: number | null = null

  /**
   * Auto-farm spec Task 3 (2026-09-04) Ã¢â‚¬â€ HoÃƒÂ n MÃ¡Â»Â¹: HP Ã„â€˜Ã¡Â»â„¢i mÃ¡ÂºÂ¥t <=75% VÃƒâ‚¬
   * turns < stage.perfectClearTurnLimit Ã¢â€ â€™ ghi perfectClearStageIds +
   * perfectClearSeconds MÃ¡Â»ËœT LÃ¡ÂºÂ¦N (khÃƒÂ´ng overwrite lÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ¡t Ã„â€˜Ã¡ÂºÂ§u).
   */
  /**
   * Auto-farm spec Task 3 (2026-09-04) — record helper marker
   */
  private recordPerfectClearIfEligible(turnBattle: TurnBattle) {
    const stage = this.activeStageForTurnBattle
    const player = this.playerDataForTurnBattle

    if (!stage || !player || stage.perfectClearTurnLimit === undefined) {
      console.log('[PC-DEBUG] early return: no stage/player/limit', { stage: !!stage, player: !!player, limit: stage?.perfectClearTurnLimit })
      return
    }

    if (player.perfectClearStageIds.includes(stage.id)) {
      return
    }

    const entity = turnBattle.players[0]?.entity

    if (!entity) {
      return
    }

    const hpLossPercent = ((entity.maxHp - entity.currentHp) / entity.maxHp) * 100

    const isPerfectClear =
      hpLossPercent <= 75 && (turnBattle.totalTurnsElapsed ?? 0) < stage.perfectClearTurnLimit

    if (!isPerfectClear) {
      return
    }

    const startedAtMs = this.turnBattleStartedAtMs ?? Date.now()
    const clearSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000)

    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = clearSeconds
  }

  /**
   * Slice 6 cutover: legacy Battle state MIRROR TurnBattle state Ã¢â‚¬â€ mÃ¡Â»Âi
   * consumer Ã„â€˜Ã¡Â»Âc getBattle()?.state (UI gates, tests) thÃ¡ÂºÂ¥y Ã„â€˜ÃƒÂºng pha trÃ¡ÂºÂ­n
   * mÃƒÂ  khÃƒÂ´ng cÃ¡ÂºÂ§n biÃ¡ÂºÂ¿t engine Ã„â€˜ÃƒÂ£ Ã„â€˜Ã¡Â»â€¢i. Countdown phase khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i trong
   * turn-based (bÃ¡Â»Â) Ã¢â‚¬â€ fighting lÃƒÂ  pha Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn.
   */
  private syncLegacyBattleState() {
    const turnBattle = this.turnBattle
    const legacy = this.battleSystem.getBattle()

    if (!turnBattle || !legacy) {
      return
    }

    if (legacy.state !== turnBattle.state) {
      legacy.state = turnBattle.state
    }
  }  /** Repeat-continuously flag tÃ¡Â»Â« startStage Ã¢â‚¬â€ driver cho auto-repeat cycle cÃ¡Â»Â§a TurnBattle. */
  private turnBattleRepeatContinuously = false

  private activeStageForTurnBattle: Stage | null = null

  private playerStatsForTurnBattle: Stats | null = null
  private playerDataForTurnBattle: PlayerData | null = null
  /**
   * Vue layer (App.vue's tick()) gÃ¡Â»Âi mÃ¡Â»â€”i tick Ã„â€˜Ã¡Â»Æ’ rÃƒÂºt toast phÃƒÂ¡t sinh
   * TRONG core kÃ¡Â»Æ’ tÃ¡Â»Â« lÃ¡ÂºÂ§n gÃ¡Â»Âi trÃ†Â°Ã¡Â»â€ºc Ã¢â‚¬â€ trÃ¡ÂºÂ£ vÃ¡Â»Â rÃ¡Â»â€œi xoÃƒÂ¡ hÃƒÂ ng Ã„â€˜Ã¡Â»Â£i.
   */
  drainNotifications(): NotificationEvent[] {
    return this.notifications.drain()
  }
}
