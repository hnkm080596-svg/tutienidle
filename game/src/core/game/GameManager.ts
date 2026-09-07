import { EventBus } from '../events/EventBus'

import { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'

import { BattleSystem } from '../battle/legacy/BattleSystem'
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
import { DEFAULT_MAX_OFFLINE_SECONDS } from '../idle/GameClock'

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
  getSpiritStoneMaterialIdForRealmTier,
} from '../material/SpiritStoneMaterial'
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
import { effectiveTotalEnemyCount } from '../stage/EffectiveEnemyCount'
import { effectiveWaves } from '../stage/EffectiveWaves'
import { ZoneRegistry } from '../stage/ZoneRegistry'
import type { Zone } from '../stage/Zone'

import { TemplateRegistry } from './TemplateRegistry'
import { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
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


// Re-export gi? tuong thï¿½ch import cu (useTribulation.ts import
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
import { PresentationGate } from '../battle/turn/PresentationGate'
import { emitTurnReady, emitTurnCastStart, emitTurnActionImpact, emitTurnStandbyComplete, emitTurnBattleEntitySnapshot } from '../battle/turn/TurnActionPresentationEvents'
import type { TurnDeclaredAction } from '../battle/turn/TurnBattleSystem'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { resolvePartyFormation } from './FormationPlacement'
import { companionToCombatEntity } from '../companion/CompanionCombat'
import { COMPANIONS } from '../../data/companion/Companions'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import { TURN_BUFF_REGISTRY } from '../../data/buff/TurnBuffRegistry'
import { TurnBuffSystem } from '../battle/turn/TurnBuffSystem'
import type { TurnBuffDefinition } from '../battle/turn/TurnBuffTypes'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'

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

// Turn-Based Wave Redesign (2026-09-06) — shared giữa buildTurnBattle()
// (dùng để khởi tạo countdownTurnsRemaining) và
// TurnActionPresentationEvents.emitTurnBattleEntitySnapshot() (dùng để
// tính countdownProgress) — tách hằng số ra để 2 nơi không bao giờ lệch.
export const COUNTDOWN_TOTAL_TICKS = 30

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
    // Talent v4 (spec 2026-09-03 ï¿½3.3 E2) ï¿½ buffApplier: apply buff
    // "bï¿½ng n?" c?a passiveConvertsTo lï¿½n PLAYER trong tr?n hi?n t?i
    // (pool c?a player, source = player; ngoï¿½i tr?n thï¿½ b? qua ï¿½
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
    // hpReader ï¿½ HP ratio c?a player entity trong tr?n; ngoï¿½i tr?n
    // undefined (passiveCondition coi nhu thï¿½ng qua).
    () => {
      const battle = this.battleSystem.getBattle()

      if (!battle || battle.player.maxHp <= 0) {
        return undefined
      }

      return battle.player.currentHp / battle.player.maxHp
    },
  )

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

  /**
   * Talent v4 (spec 2026-09-03 ï¿½4.1, plan M1 Task 4) ï¿½ grant/revoke
   * hidden passive skill c?a talent combat dang ch?n vï¿½o SkillManager.
   * Idempotent: revoke m?i talent passive cu tru?c khi grant (d?i
   * talent qua save edit khï¿½ng nhï¿½n dï¿½i, khï¿½ng leak gi?a player).
   * G?i sau setActivePlayer/restore + sau khi App.vue ghi
   * selectedTalentIds lï¿½c t?o nhï¿½n v?t.
   */
  syncTalentCombatPassive(player: PlayerData) {
    const allTalentPassiveIds = TALENT_PASSIVE_SKILLS.map((skill) => skill.id)

    // Revoke m?i talent passive hi?n cï¿½ (dï¿½ dï¿½ng talent ï¿½ grant l?i
    // ngay sau, d?m b?o idempotent + khï¿½ng k?t passive cu khi d?i).
    for (const passiveId of allTalentPassiveIds) {
      if (this.skillManager.get(passiveId)) {
        this.skillManager.remove(passiveId)
      }
    }

    // Grant theo talent ï¿½?U TIï¿½N (collectTalentEffects si?t id d?u ï¿½
    // spec ï¿½3.2): m?i talent combat khai 1-2 combat_passive effect.
    for (const effect of collectTalentEffects(player.selectedTalentIds)) {
      if (effect.kind === 'combat_passive') {
        const template = getTalentPassiveSkill(effect.passiveSkillId)

        if (template) {
          // Copy shallow ï¿½ passiveModifiers stacks lï¿½ state runtime
          // per-battle, khï¿½ng chia s? object v?i template data.
          this.skillManager.add({ ...template, passiveModifiers: template.passiveModifiers?.map((modifier) => ({ ...modifier })) })
        }
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

    // Final review fix (Important #6) — nguồn sự thật DUY NHẤT cho việc
    // kích hoạt channel Bạt Kiếm, khớp đúng điều kiện channel UI đang
    // đọc (player.kiemTuRoute === 'bat_kiem').
    () => this.activePlayer?.kiemTuRoute,

    // Ki?m ï¿½ vinh vi?n (spec 2026-08-29-kiem-the-kiem-y m?c 3) ï¿½ closure
    // ï¿½ï¿½ khai bï¿½o trong BattleSystem nhung chua t?ng du?c inject ? dï¿½y
    // (profile kiem-tu ï¿½4.7): thi?u nï¿½ ? Ki?m ï¿½ t?m d?u tr?n = 0, nerf
    // B?t Ki?m m?c k?t 0.6, on-hit khï¿½ng roll. ï¿½?c LIVE t? bossKillCount.
    () => (this.activePlayer ? getKiemYPermanent(this.activePlayer.bossKillCount) : 0),

    // H?p th? Huy Ki?m (spec m?c 3.4) ï¿½ t?ng cast c?a tram, d?c LIVE t?
    // skillManager (flat bonus floor(casts/10) vï¿½o B?t Ki?m tick).
    () => this.skillManager.get('tram')?.totalExperience ?? 0,

    // On-hit Ki?m Tr?n (spec m?c 4) ï¿½ c?p node on-hit dï¿½ mua, l?c qua
    // nodeRegistry (ch? node cï¿½ effect.onHitEffect).
    () => this.getOnHitNodeLevelsSnapshot(),

    // Phï¿½p Tu Thu?n H? (Task 12, 2026-09-03) ï¿½ hï¿½nh Thu?n dang ch?n, d?c
    // LIVE t? node lap_dao_thuan_<el> dï¿½ mua (PlayerData lï¿½ authority).
    () => this.getPhapTuThuanElement(),
  )

  // =========================
  // TURN-BASED COMBAT (Slice 6 cutover) — engine thật điều khiển combat.
  // BattleSystem.ts vẫn giữ field tới khi mọi consumer nội bộ flip xong
  // (legacy battle state dùng bởi passiveSystem/tribulation side).
  // =========================
  private turnBattleSystem = new TurnBattleSystem(this.combatSystem)

  private turnBattle: TurnBattle | null = null

  /** Template enemy gần nhất đã spawn (fallback cho spawnEnemy factory). */
  private lastStageEnemyTemplate: Enemy | null = null

  /**
   * Snapshot c?p cï¿½c node on-hit Ki?m Tr?n dï¿½ mua (d?c t?
   * PlayerData.nodeLevels qua registry ï¿½ node lï¿½ ngu?n s? th?t c?a
   * `effect.onHitEffect`). Tr? `{}` khi chua cï¿½ player/chua mua node.
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
   * Phï¿½p Tu Thu?n H? (Task 12, 2026-09-03) ï¿½ hï¿½nh Thu?n ï¿½ANG CH?N c?a
   * player ho?t d?ng: node `lap_dao_thuan_<el>` (keystone mutex ï¿½ data
   * d?m b?o t?i da 1 hï¿½nh) dï¿½ mua level = 1. undefined = chua L?p ï¿½?o
   * Thu?n / khï¿½ng ph?i Phï¿½p Tu ? chain khï¿½ng gate, ult khï¿½ng n?.
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

  // Task 14 (rework P4) ï¿½ Tab Phï¿½n Gi?i: khoï¿½ng ? Luy?n Khï¿½ Tinh Hoa.
  readonly decomposeSystem = new DecomposeSystem(this.materialBag, { autoWorkerCapacity: 0 })

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
  private readonly tribulationDirector: TribulationDirector
  private readonly equipmentOps: EquipmentOpsSystem
  private readonly buildingOps: GameManagerBuildingOps
  private readonly alchemyOps: GameManagerAlchemyOps
  private readonly questOps: GameManagerQuestOps
  private readonly saveRestore: GameManagerSaveRestore

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
      settleAutoFarmOffline: (player, elapsedSeconds) =>
        this.settleAutoFarmOffline(player, elapsedSeconds),
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
        throw new Error(`Alchemy recipe ${recipe.id}: herb variants trï¿½ng l?p`)
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

      // Ki?m Th? / Ki?m ï¿½ (spec 2026-08-29 m?c 5.1) ï¿½ ki?m tr?n ti?n
      // hï¿½a: m?i route ï¿½ï¿½NG 1 active skill ? slot 0, keystone m?i t?
      // THAY TH? tr?n cu (equipToSlot t? d?i occupant cu). KHï¿½NG cï¿½n
      // slot riï¿½ng KIEM_TRAN_SLOT_INDEX.
      if (skillId.startsWith('kiem_tran_')) {
        this.skillSystem.equipToSlot(skillId, 0)
      }
    }

    // Phï¿½p Tu Thu?n H? (E-8, 2026-09-03) ï¿½ node bi?n th?: mua node lï¿½ CH?N
    // specialization c?a skill qua SkillSystem (cï¿½ng du?ng
    // selectSkillSpecialization c?a UI). Skill chua h?c / spec khï¿½ng t?n
    // t?i ? selectSpecialization tr? false, KHï¿½NG rollback purchase (data
    // Task 8 t? d?m b?o prereq unlocksSkillIds ch?y tru?c trong vï¿½ng l?p
    // trï¿½n).
    const selectsSpec = node.effect.selectsSpecialization

    if (selectsSpec) {
      this.skillSystem.selectSpecialization(selectsSpec.skillId, selectsSpec.specializationId)
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

    // Ki?m Th? / Ki?m ï¿½ (spec 2026-08-29-kiem-the-kiem-y m?c 1) ï¿½ route
    // ch?t VINH VI?N dï¿½ng lï¿½c ch?n path: Huy Ki?m (tram) dï¿½ d?t Lv3
    // (10.000 l?n tr?m) ? B?t Ki?m; chua ? Ki?m Tr?n. KHï¿½NG cï¿½n API
    // d?i route (setKiemTuRoute dï¿½ d?) ï¿½ branch node cï¿½n l?i b? ?n ?
    // UI (SkillPathPanel hi?n th? dï¿½ng 1 branch theo route).
    // kit.skillIds c?a Ki?m Tu gi? KHï¿½NG dï¿½ng n?a (m?i route 1 skill
    // duy nh?t, gï¿½n trong nhï¿½nh nï¿½y) ï¿½ tuple 3-skill cu dï¿½ d? kh?i
    // CultivationPathKit.
    if (pathId === 'kiem_tu') {
      const tramCasts = player.skillCastCounts?.['tram'] ?? 0
      const route: KiemTuRoute = tramCasts >= HUY_KIEM_L3_CASTS ? 'bat_kiem' : 'kiem_tran'

      player.kiemTuRoute = route

      // M?i route ï¿½ï¿½NG 1 active skill duy nh?t (spec m?c 5) ï¿½ thï¿½o b?
      // skill kit cu + tram kh?i loadout (KHï¿½NG unlearn: Phï¿½m Nhï¿½n save
      // khï¿½c v?n dï¿½ng tram du?c; Ki?m Tu dï¿½ ch?t route thï¿½ tram b? khï¿½a
      // re-equip qua guard ? SkillSystem ï¿½ xem guard tram phï¿½a du?i).
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

      // Spec dot-pha-loi-kiep ï¿½4.2 ï¿½ snapshot "hoï¿½n h?o Phï¿½m Nhï¿½n"
      // (5/5 main stat d?t cap mortal + Luy?n Th th? 6/6) ch?t dï¿½ng
      // lï¿½c b?m Quï¿½n Khï¿½, KHï¿½NG h?i c?u sau khi vï¿½o Luy?n Khï¿½. Lï¿½ 1
      // di?u ki?n ï¿½?i ï¿½?o Trï¿½c Co.
      player.mortalPerfectionAchieved =
        player.bodyRefinementCompletedTiers >= BODY_REFINEMENT_TIERS.length &&
        MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= getMainStatCap('mortal'))

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      this.syncRealmPassive(player)
      this.syncRealmStatPassive(player)
    }

    // Ki?m Th? / Ki?m ï¿½ (spec m?c 1/5) ï¿½ grant skill route SAU realm
    // advance: root Lu?ng Nghi cï¿½ realm prereq 'qi_refining', ph?i d?i
    // L? Nh?p Mï¿½n d?i realm xong m?i purchaseNode du?c. M?i route ï¿½ï¿½NG
    // 1 active skill ? slot 0 (don ki?m/b?t ki?m th?c ho?c da ki?m/
    // lu?ng nghi ti?n hï¿½a).
    if (pathId === 'kiem_tu' && player.kiemTuRoute === 'bat_kiem') {
      this.learnSkill('bat_kiem_thuat')
      this.skillSystem.equipToSlot('bat_kiem_thuat', 0)
    } else if (pathId === 'kiem_tu') {
      this.purchaseNode('kiem_tran_luong_nghi', player)
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

    if (battle && (battle.state === 'countdown' || battle.state === 'fighting')) {
      return false
    }

    player.artifact.selectedPath = path

    return true
  }

  /**
   * Ki?m Tu t? l?c (2026-08-28) t?ng cï¿½ setKiemTuRoute() d?i route
   * ngoï¿½i combat ï¿½ ï¿½ï¿½ D? (spec 2026-08-29-kiem-the-kiem-y m?c 1): route
   * gi? ch?t VINH VI?N trong chooseCultivationPath('kiem_tu') theo
   * tram Lv3, khï¿½ng cï¿½n thao tï¿½c d?i sau nï¿½y.
   */


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

    if (battle && (battle.state === 'countdown' || battle.state === 'fighting')) {
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

    // Load save: b? effect dï¿½ h?t h?n ngay (plan ï¿½9).
    this.tickTimedEffects(player)

    // Talent v4 (spec 2026-09-03 ï¿½4.1) ï¿½ grant hidden passive c?a
    // talent combat ngay khi active player d?i (load save / restore /
    // sau L? Nh?p Mï¿½n t?o nhï¿½n v?t).
    this.syncTalentCombatPassive(player)
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
   * T? LINH TR?N (economy-fixes-sinks-plan ï¿½3.2 B1, 2026-08-29) ï¿½ sink
   * Linh Th?ch mua % t?c d? tu luy?n 24h. Cost leo thang theo s? effect
   * Cï¿½NG NHï¿½M dang active (expiresAtMs > now); ch? M?T effect group t?n
   * t?i t?i 1 th?i di?m (stack policy MVP c?a applyTimedEffect ï¿½ refresh
   * deadline). Giao d?ch atomic: thi?u Linh Th?ch ? khï¿½ng tr? gï¿½.
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

    // Yêu cầu 2026-08-26 — HP/s & MP/s mặc định của tâm pháp: flat trực
    // tiếp lên 2 stat hồi/giây, áp cho MỌI technique khai tierEffects.
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
   * Gate d?t phï¿½ unified ï¿½ 1 hï¿½m cho M?I c?nh gi?i. Tr? v? true n?u
   * ngu?i choi d? di?u ki?n b?m nï¿½t ï¿½?t Phï¿½ (Quï¿½n Khï¿½ / Trï¿½c Co / ...).
   *
   * PRODUCT SCOPE: game hi?n ch? thi?t k? t?i Trï¿½c Co t?ng 18. Cï¿½c realm
   * placeholder (Kim ï¿½an+) tr? false cho t?i khi cï¿½ content pass tuong ?ng.
   */
  canTriggerBreakthrough(player: PlayerData): boolean {
    if (player.realmId === 'mortal' || player.realmId === 'qi_refining') {
      return player.realmLevel >= CORE_REALM_LEVEL
    }
    return false
  }

  /**
   * Hï¿½A Bï¿½N (economy-fixes-sinks-plan ï¿½3.2 B2, 2026-08-29) ï¿½ bï¿½n nguyï¿½n
   * li?u th?a cho Vendor l?y Linh Th?ch dï¿½ng ph?m. VendorSystem kh?i t?o
   * per-call (nh?, stateless) v?i registry + dan phuong hi?n hï¿½nh ï¿½ sole-
   * ingredient guard c?n danh sï¿½ch herbVariants c?a m?i recipe.
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
   * Danh sï¿½ch material ngu?i choi ï¿½ANG S? H?U vï¿½ bï¿½n du?c cho Vendor
   * (Kï¿½ B?o Cï¿½c, 2026-08-30) ï¿½ dï¿½ng cho VendorPanel.vue li?t kï¿½ UI, tï¿½ch
   * kh?i sellMaterialToVendor() (hï¿½nh d?ng) d? panel khï¿½ng t? l?p logic
   * l?c category/giï¿½.
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

  // Tï¿½ch kh?i GameManager (2026-09-02, task 1 ï¿½ GameManager split) ï¿½
  // toï¿½n b? logic dï¿½ chuy?n sang EquipmentOpsSystem (xem
  // EquipmentOpsSystem.ts). Cï¿½c method du?i dï¿½y lï¿½ thin delegate GI?
  // NGUYï¿½N public API d? call site ngoï¿½i GameManager.ts khï¿½ng ph?i d?i.

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
  // BUILDING + PRODUCTION ï¿½ toï¿½n b? logic dï¿½ chuy?n sang
  // GameManagerBuildingOps (xem GameManagerBuildingOps.ts, task 2 ï¿½
  // GameManager split). Cï¿½c method du?i dï¿½y lï¿½ thin delegate GI? public
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
  // ALCHEMY ï¿½ toï¿½n b? logic dï¿½ chuy?n sang GameManagerAlchemyOps (xem
  // GameManagerAlchemyOps.ts, task 3 ï¿½ GameManager split). Cï¿½c method
  // du?i dï¿½y lï¿½ thin delegate GI? public API cho UI/composables/tests.
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

    // Slice 6 cutover: d?ng d?ng th?i TurnBattle ï¿½ engine turn-based ch?y
    // SONG SONG v?i real-time battle (v?n lï¿½ ngu?n s? th?t cho cï¿½c consumer
    // n?i b? chua flip). resolveNextStep() drive qua updateBattleFixedStep.
    this.turnBattle = this.buildTurnBattle(player, [enemyEntity])
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
      const element = this.getPhapTuThuanElement() ?? 'fire'
      return BASIC_ATTACKS_BY_BUILD[`phap_tu_${element}`] ?? GENERIC_PHYSICAL_BASIC
    }

    return GENERIC_PHYSICAL_BASIC
  }

  // Bug fix (2026-09-06, user report) — quái spawn giữa trận (wave thứ 2 trở
  // đi, factory truyền cho TurnBattleSystem ở startTurnBattle()/restart cycle)
  // KHÔNG hề gọi resolveEnemySpawnPosition() như buildTurnBattle() làm cho
  // quái ĐẦU TIÊN, nên entity giữ nguyên x:0/row:0 mặc định của
  // enemyToCombatEntity() — luôn dính góc trên-trái thay vì random trong
  // ENEMY_SIDE_REGION. Helper dùng chung để 2 closure spawn giữa trận
  // (startTurnBattle + restartTurnBattleCycle) không lệch nhau lần nữa.
  private placeSpawnedEnemy(entity: CombatEntity): CombatEntity {
    const position = resolveEnemySpawnPosition({
      isBoss: entity.isBoss ?? false,
      random: Math.random,
    })

    entity.row = position.row
    entity.x = position.column

    return entity
  }

  private buildTurnBattle(playerEntity: CombatEntity, enemyEntities: CombatEntity[]): TurnBattle {
    const playerPath = this.activePlayer

    // Party placement (Trận Pháp spec §6-7, 2026-09-05) — vị trí party đọc
    // từ player.formationLoadout THẬT qua resolvePartyFormation() (Task 18),
    // fallback về DEFAULT_PARTY_FORMATION khi player chưa cấu hình trận
    // pháp nào (chưa có playerPath, hoặc formationLoadout === null — xử lý
    // ngay trong resolvePartyFormation()).
    const formation = playerPath ? resolvePartyFormation(playerPath) : DEFAULT_PARTY_FORMATION

    const playerSlot = formation.find((slot) => slot.combatantId === 'player')

    if (playerSlot) {
      playerEntity.row = playerSlot.row
      playerEntity.x = playerSlot.column
    }

    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
    )

    // Companion Roster (2026-09-05) — mỗi companion trong player.companions
    // được dựng lại thành CombatEntity/TurnBattleParticipant TƯƠI MỚI mỗi
    // trận (companionToCombatEntity, Task 12), đặt tại đúng ô mà
    // formationLoadout đã gán cho combatantId của nó. Companion thiếu
    // definition (roster đã đổi) hoặc thiếu slot (chưa gán ô trong trận
    // pháp hiện tại) bị bỏ qua thay vì làm crash cả trận.
    const companionParticipants = (playerPath?.companions ?? []).flatMap((instance, index) => {
      const definition = COMPANIONS.find((candidate) => candidate.id === instance.definitionId)
      const slot = formation.find((entry) => entry.combatantId === instance.definitionId)

      if (!definition || !slot) {
        return []
      }

      const entity = companionToCombatEntity(instance, definition)

      entity.row = slot.row
      entity.x = slot.column

      return [toTurnBattleParticipant(entity, index + 100, definition.basic)]
    })

    // Trận Pháp buff (2026-09-05) — trận pháp đang active áp MỘT buff đồng
    // nhất cho toàn bộ party (player + companion) ngay khi trận bắt đầu.
    // Dùng thẳng TURN_BUFF_REGISTRY thật (không phải field riêng trên
    // GameManager) — registry này cũng chính là registry truyền vào cả 2
    // nơi khởi tạo TurnBattleSystem bên dưới, nên buff áp ở đây tương thích
    // với convertsToId/stack logic mà TurnBattleSystem xử lý trong trận.
    if (playerPath?.formationLoadout) {
      const formationDefinition = TRAN_PHAP_FORMATIONS.find(
        (candidate) => candidate.id === playerPath.formationLoadout!.formationId,
      )

      if (formationDefinition) {
        // Content Trận Pháp có thể tham chiếu buff id chưa tồn tại (gõ sai
        // definitionId, hoặc buff chưa kịp thêm vào buffs.ts) —
        // TURN_BUFF_REGISTRY.get() throw trong trường hợp đó. Bắt lỗi và bỏ
        // qua buff (không áp gì cả) thay vì để cả trận đấu crash — cùng
        // tinh thần "skip gracefully" với companion resolution ở trên
        // (review Task 19 phát hiện).
        let buffDefinition: TurnBuffDefinition | undefined

        try {
          buffDefinition = TURN_BUFF_REGISTRY.get(formationDefinition.buff.definitionId)
        } catch {
          buffDefinition = undefined
        }

        if (buffDefinition) {
          for (const participant of [playerParticipant, ...companionParticipants]) {
            new TurnBuffSystem(participant.buffs).apply(
              buffDefinition,
              participant.entity,
              participant.entity,
              TURN_BUFF_REGISTRY,
            )
          }
        }
      }
    }

    // Spawn placement (Combat Art Pipeline §6/§7, 2026-09-05) — vị trí spawn
    // đứng yên tại resolve, không di chuyển. Tái dùng đúng
    // resolveEnemySpawnPosition() của hệ sống: quái giới hạn trong
    // ENEMY_SIDE_REGION, Boss LUÔN ở trung tâm vùng địch (center), quái
    // thường random đều trong vùng.
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
      players: [playerParticipant, ...companionParticipants],
      enemies: enemyParticipants,
      state: 'countdown',
      // 3s countdown hết số → 30 pacing ticks (BATTLE_FIXED_STEP 0.1s).
      countdownTurnsRemaining: COUNTDOWN_TOTAL_TICKS,
      totalTurnsElapsed: 0,
    }
  }

  /** Tr?ng thï¿½i turn-based hi?n t?i ï¿½ consumer n?i b? flip d?n sang dï¿½y. */
  /**
   * Auto-repeat cycle (Completion Task 8): dựng TurnBattle mới sau victory
   * khi repeatContinuously bật — giữ player participant (HP/resource giữ
   * nguyên như hệ sống restartCycle), enemies mới qua spawnEnemy factory.
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
    this.pendingReadyActor = null
    this.pendingDeclaredAction = null
    this.pendingImpact = null

    this.turnBattle = {
      players: previous.players,
      enemies: [],
      // Auto-repeat cycle giữa stage KHÔNG countdown lại (countdown chỉ ở
      // đầu trận/bắt đầu stage — hệ sống restartCycle giữ fighting ngay).
      state: 'fighting',
      totalTurnsElapsed: 0,
      wave: {
        totalEnemyCount: effectiveTotalEnemyCount(stageRef),
        spawnedCount: 0,
        waves: effectiveWaves(stageRef),
        waveIndex: 0,
        pendingEnemySpawns: [],
      },
    }

    this.turnBattleSystem = new TurnBattleSystem(
      this.combatSystem,
      10_000,
      TURN_BUFF_REGISTRY,
      () => {
        const isFinalSpawn = (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= effectiveTotalEnemyCount(stageRef)
        const template =
          this.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn) ??
          this.lastStageEnemyTemplate

        if (!template) {
          throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
        }

        this.lastStageEnemyTemplate = template

        return toTurnBattleParticipant(
          this.placeSpawnedEnemy(enemyToCombatEntity(this.enemySystem.spawn(template))),
          this.turnBattle?.enemies.length ?? 0,
          GENERIC_PHYSICAL_BASIC,
        )
      },
    )
  }

  getTurnBattle(): TurnBattle | null {
    return this.turnBattle
  }

  // --- Slice 7 (Completion Task 10) — manual mode --------------------------

  private battleManualMode = false

  /**
   * Actor phe player đang bị PAUSE chờ manual choice (manual mode), hoặc
   * null khi không pause (auto mode, lượt enemy, hoặc chưa tới lượt).
   * Reset khi battle kết thúc/restart.
   */
  private awaitedManualActor: TurnBattleParticipant | null = null

  /** Bật/tắt manual mode. Tắt giữa lúc đang chờ choice → hủy pause, engine tự chạy tiếp. */
  setBattleManualMode(enabled: boolean): void {
    this.battleManualMode = enabled

    if (!enabled) {
      this.awaitedManualActor = null
    }
  }

  isBattleManualMode(): boolean {
    return this.battleManualMode
  }

  /** Đang pause chờ player chọn skill cho lượt của chính mình? */
  isAwaitingManualTurnChoice(): boolean
  {
    return this.awaitedManualActor !== null
  }

  // --- Action Playback Task 6 (2026-09-05) — presentation orchestration ---

  /**
   * false (mặc định): fixed-step tick resolve turn ngay lập tức (mọi
   * headless test không đổi). true (CombatScene mount): engine chạy 5-phase
   * state machine — ready → cast → impact → complete — chờ Phaser
   * acknowledge qua 3 method dưới trước khi sang bước kế.
   */
  private presentationActive = false

  /** Defect Task 3 (2026-09-05) — boot-race gate: chờ CombatScene mount lần
  * đầu (hoặc safety-net timeout) trước khi tick battle — chặn headless-
  * resolve toàn bộ trận 1 trước Phaser kịp mount. */
  private readonly presentationGate = new PresentationGate()

  /** Called once at real-app boot ONLY (App.vue) — never from test fixtures. */
  expectPresentationLayer(): void {
    this.presentationGate.expect()
  }

  /** True while the very first Phaser boot hasn't finished mounting CombatScene yet. */
  isAwaitingPresentationLayer(): boolean {
    return this.presentationGate.isBlocking()
  }

  /** Tick đã peek actor ready, chờ acknowledgeTurnReady(). */
  private pendingReadyActor: TurnBattleParticipant | null = null

  /** Đã declare action, chờ acknowledgeActionImpact(). */
  private pendingDeclaredAction: { actor: TurnBattleParticipant; declared: TurnDeclaredAction } | null = null

  /** Đã áp damage, chờ acknowledgeActionComplete(). */
  private pendingImpact: { actor: TurnBattleParticipant; declared: TurnDeclaredAction; targetIds: string[] } | null = null

  // Remediation Task 1 (2026-09-05) — playback token: mỗi lần phase tiến
  // tới 'ready' sinh 1 token mới; stale ack (token cũ) là no-op, chặn
  // callback Phaser muộn đụng action/battle khác (cross-battle mutation).
  private playbackToken = ''
  private playbackTokenSeq = 0

  private nextPlaybackToken(): string {
    this.playbackTokenSeq += 1
    this.playbackToken = `playback-${this.playbackTokenSeq}`

    return this.playbackToken
  }

  /** Test/UI đọc token hiện tại của phase đang chờ (null nếu không pending). */
  getPendingPlaybackToken(): string | null {
    return this.pendingReadyActor !== null || this.pendingDeclaredAction !== null || this.pendingImpact !== null
      ? this.playbackToken
      : null
  }

  setPresentationActive(active: boolean): void {
    this.presentationActive = active

    if (active) {
      // Defect Task 3 — Phaser mounted lần đầu: mở boot-race gate (sticky).
      this.presentationGate.markReady()
    } else {
      // Rời CombatScene giữa chừng — hoàn tất pending phases ngay lập tức
      // (headless path) để trận không bị treo.
      if (this.pendingReadyActor && this.turnBattle) {
        const actor = this.pendingReadyActor
        this.pendingReadyActor = null

        // Defect Task 4 (2026-09-05) — manual player ở ready-phase KHÔNG
        // được auto-resolve bằng AI khi rời scene: chuyển vào
        // awaitedManualActor giữ choice chờ submitTurnChoice (cùng nhánh
        // với acknowledgeTurnReady()).
        const isManualActor = this.battleManualMode && this.turnBattle.players.includes(actor)

        if (isManualActor) {
          this.awaitedManualActor = actor
        } else {
          const declared = this.turnBattleSystem.declareActorAction(this.turnBattle, actor)
          const { targetIds } = this.turnBattleSystem.applyActionImpact(this.turnBattle, declared)
          this.turnBattleSystem.completeAction(this.turnBattle, actor, declared, targetIds)
        }
      } else if (this.pendingDeclaredAction && this.turnBattle) {
        const { actor, declared } = this.pendingDeclaredAction
        this.pendingDeclaredAction = null

        const { targetIds } = this.turnBattleSystem.applyActionImpact(this.turnBattle, declared)
        this.turnBattleSystem.completeAction(this.turnBattle, actor, declared, targetIds)
      } else if (this.pendingImpact && this.turnBattle) {
        const { actor, declared, targetIds } = this.pendingImpact
        this.pendingImpact = null

        this.turnBattleSystem.completeAction(this.turnBattle, actor, declared, targetIds)
      }
    }
  }

  isActionPlaybackWaiting(): boolean {
    return this.pendingReadyActor !== null || this.pendingDeclaredAction !== null || this.pendingImpact !== null
  }

  /** Phaser gọi khi ready flourish xong → declare action, phát 'attack'. */
  acknowledgeTurnReady(token?: string): void {
    // Remediation Task 1 — stale token (khớp token của action cũ) là no-op.
    if (token !== undefined && token !== this.playbackToken) {
      return
    }

    if (!this.pendingReadyActor || !this.turnBattle) {
      return
    }

    const actor = this.pendingReadyActor
    this.pendingReadyActor = null

    if (this.battleManualMode && this.turnBattle.players.includes(actor)) {
      // Slice 7 manual-choice flow giữ nguyên — pause chờ submitTurnChoice.
      this.awaitedManualActor = actor
      return
    }

    const declared = this.turnBattleSystem.declareActorAction(this.turnBattle, actor)
    this.pendingDeclaredAction = { actor, declared }

    emitTurnCastStart(this.eventBus, actor.id, declared.skillId, declared.affected.map((target) => target.id))
  }

  /** Phaser gọi tại impact frame (lunge tween xong) → áp damage, phát VFX. */
  acknowledgeActionImpact(token?: string): void {
    // Remediation Task 1 — stale token là no-op.
    if (token !== undefined && token !== this.playbackToken) {
      return
    }

    if (!this.pendingDeclaredAction || !this.turnBattle) {
      return
    }

    const { actor, declared } = this.pendingDeclaredAction
    this.pendingDeclaredAction = null

    const { targetIds } = this.turnBattleSystem.applyActionImpact(this.turnBattle, declared)
    this.pendingImpact = { actor, declared, targetIds }

    const primaryTargetId = targetIds[0] ?? declared.affected[0]?.id ?? ''
    const anchorEntity =
      this.turnBattle.players.find((member) => member.id === primaryTargetId)?.entity ??
      this.turnBattle.enemies.find((enemy) => enemy.id === primaryTargetId)?.entity

    const row = anchorEntity?.row ?? 0
    const column = Math.round(anchorEntity?.x ?? 0)

    emitTurnActionImpact(this.eventBus, {
      actionId: `${actor.id}-${this.turnBattle.totalTurnsElapsed ?? 0}`,
      sourceId: actor.id,
      primaryTargetId,
      anchorCell: { row, column },
      affectedArea: {
        shape: declared.action?.targeting.shape ?? 'single',
        rowStart: row,
        rowEnd: row,
        colStart: column,
        colEnd: column,
      },
      affectedTargetIds: declared.affected.map((target) => target.id),
      landedTargetIds: targetIds,
      dodgedTargetIds: declared.affected
        .filter((target) => !targetIds.includes(target.id))
        .map((target) => target.id),
      hitCount: 1,
      presetId: declared.action?.skill?.presetId,
    })

    this.syncLegacyBattleState()
  }

  /** Phaser gọi khi VFX tween xong → turn cleanup, phát standby tail. */
  acknowledgeActionComplete(token?: string): void {
    // Remediation Task 1 — stale token là no-op.
    if (token !== undefined && token !== this.playbackToken) {
      return
    }

    if (!this.pendingImpact || !this.turnBattle) {
      return
    }

    const { actor, declared, targetIds } = this.pendingImpact
    this.pendingImpact = null

    this.turnBattleSystem.completeAction(this.turnBattle, actor, declared, targetIds)

    emitTurnStandbyComplete(this.eventBus, actor.id)

    this.syncLegacyBattleState()
  }

  /**
   * UI submit choice cho lượt đang pause. Trả false nếu không có pause
   * (no-op an toàn — choice bị bỏ, không crash).
   */
  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    if (!this.awaitedManualActor || !this.turnBattle) {
      return false
    }

    const actor = this.awaitedManualActor
    this.awaitedManualActor = null

    if (this.presentationActive) {
      // Action Playback Task 6 — declare thay vì resolve ngay; impact
      // áp khi Phaser acknowledge (cùng 5-phase machine như auto path).
      const declared = this.turnBattleSystem.declareActorAction(this.turnBattle, actor, role)
      this.pendingDeclaredAction = { actor, declared }

      emitTurnCastStart(this.eventBus, actor.id, declared.skillId, declared.affected.map((target) => target.id))

      return true
    }

    this.turnBattleSystem.resolveActorTurn(this.turnBattle, actor, role)

    this.syncLegacyBattleState()

    return true
  }

  /**
   * Dành cho UI: id của actor đang pause (luôn là 'player' ở engine hiện
   * tại — party nhiều người là redesign tương lai), null khi không pause.
   */
  consumeAwaitedActorId(): string | null {
    return this.awaitedManualActor?.id ?? null
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
      // v4 (spec 2026-09-03 ï¿½4.1) ï¿½ B?t T? Th th?: t?y debuff + T?
      // Sinh Ng? khi guard c?u s?ng. BuffSystem b?c pool c?a PLAYER
      // trong tr?n nï¿½y (getBuffSystem dï¿½ cï¿½ c?a BattleSystem cï¿½ng pool
      // ï¿½ t? d?ng d? khï¿½ng l? internal map).
      surviveEffects: {
        buffSystem: new BuffSystem(this.battleSystem.getPlayerBuffs() ?? new BuffPool()),
        registry: this.buffRegistry,
      },
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

    // Phï¿½p Tu Thu?n H? (Task 12, spec ï¿½7) ï¿½ gate chu?i A?B?C?D?E cho
    // Phï¿½p Tu dï¿½ L?p ï¿½?o Thu?n: setChainDefinition theo hï¿½nh d?c t? node
    // lap_dao_thuan_<el> (d?c LIVE, cï¿½ng ngu?n v?i closure ult).
    // undefined = khï¿½ng gate (m?i path cu/Ki?m Tu/guest gi? nguyï¿½n).
    // Session-scoped: chain lï¿½ state c?a BattleSystem (s?ng qua stop()),
    // set M?I l?n start d? tr?n k? khï¿½ng th?a hu?ng definition c?a player
    // tru?c (multi-player session).
    const thuanElement =
      player.cultivationPath === 'phap_tu' ? this.getPhapTuThuanElement() : undefined

    this.battleSystem.setChainDefinition(
      thuanElement ? { skillIds: [...CHAIN_SKILL_IDS[thuanElement]] } : undefined,
    )

  }

  /**
   * Slice 6 cutover (unified flow): getBattle() trả TurnBattle khi có trận
   * turn-based — là NGUỒN SỰ THẬT DUY NHẤT cho mọi consumer (tests + 7 UI
   * sites). Shape TurnBattle có `state` ('countdown' khớp isBattleInProgress
   * hệ sống), `player`, `enemies[]` — đủ cho read-only consumers.
   * Legacy Battle (real-time) chỉ trả khi KHÔNG có turnBattle (tribulation
   * side chưa cutover).
   */
  getBattle(): Battle | null {
    if (this.turnBattle) {
      return this.turnBattle as unknown as Battle
    }

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
          // 9.8 — Linh Thạch tràn túi: quest chỉ tính delivered + toast.
          const overflow = this.materialBag.add(this.materialRegistry.get(spiritStoneId), amount)

          this.notifyQuestMaterialGained(spiritStoneId, amount - overflow)

          if (overflow > 0) {
            this.notifications.push(
              createBagOverflowEvent(this.materialRegistry.get(spiritStoneId).name, overflow),
            )
          }
        }
      },
    )
  }

  // =========================
  // QUEST (Nhiệm Vụ)
  // =========================

  // Tï¿½ch kh?i GameManager (2026-09-03, task 4 ï¿½ GameManager split) ï¿½ logic
  // th?t n?m trong GameManagerQuestOps (xem GameManagerQuestOps.ts). Cï¿½c
  // method du?i dï¿½y lï¿½ thin delegate GI? NGUYï¿½N public API d? call site
  // ngoï¿½i GameManager.ts (QuestPanel.vue...) khï¿½ng ph?i d?i.
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
  // (task 4 brief scope) but is unrelated to quests ï¿½ it advances Phï¿½p Tu
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


  /** Tr? l?i cï¿½u h?i tï¿½m ma hi?n t?i (overlay Vue g?i qua facade nï¿½y). */
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
   * Áp 1 buff/debuff PERSISTENT (ngoài trận) lên player — dùng cho
   * Kiếp Thương khi thất bại Độ Kiếp (mục 13 spec `breakthrough`).
   * Cùng buffSystem/buffManager nuôi getAggregatedModifiers() mỗi
   * tick (xem PillSystem's effect 'buff' — cùng cơ chế).
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
    // Slice 6 cutover: TurnBattle lï¿½ ngu?n s? th?t cho "tr?n dang ch?y".
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

    // Audit fix 2026-08-31 ï¿½ enemy s?ng + pending spawn c?a tr?n b? b? khï¿½ng
    // qua victory flow (processDefeatedEnemies despawn) ? orphan vinh vi?n
    // trong EnemyManager. Clear ? ï¿½ï¿½NG di?m h?y tr?n, khï¿½ng d?ng flow victory
    // (StageWave auto-repeat spawn tr?n m?i ngay sau victory).
    this.enemyManager.clear()

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
    const started = this.stageWaves.start(player, playerStats, stage, repeatContinuously)

    if (!started) {
      return false
    }

    this.turnBattleRepeatContinuously = repeatContinuously
    this.activeStageForTurnBattle = stage
    this.playerDataForTurnBattle = player
    this.playerStatsForTurnBattle = playerStats

    // Slice 6 cutover (Completion Task 8): stage chạy trên TurnBattle —
    // wave config (Slice 5) + spawnEnemy factory wrap pickEnemyForSpawn
    // (spec §5.3 thin adapter). Enemy đầu tiên đã spawn qua launchBattle
    // → startBattle → buildTurnBattle; bổ sung wave state vào TurnBattle.
    if (this.turnBattle) {
      // Gameplay fixes (2026-09-05): reset per-battle flags at every fresh
      // startStage (NOT just restartTurnBattleCycle) — without this, the
      // 2nd refight inherits turnBattleEndEmitted=true from the previous
      // battle and its victory terminal never fires (stopRepeat never
      // releases StageManager -> 3rd refight startStage fails).
      this.turnBattleRewardsGranted.clear()
      this.turnBattleEndEmitted = false
      this.awaitedManualActor = null
      this.pendingReadyActor = null
      this.pendingDeclaredAction = null
      this.pendingImpact = null
      this.turnBattleStartedAtMs = Date.now()


      // Turn-Based Wave Redesign (2026-09-06) — StageWaveSystem.start()
      // (qua launchBattle → startBattleWithPlayer → startBattle →
      // buildTurnBattle) đã spawn THẲNG 1 quái bootstrap vào
      // this.turnBattle.enemies (bootstrap này PHỤC VỤ CHUNG cho cả legacy
      // real-time engine — KHÔNG SỬA). User yêu cầu MỌI quái (kể cả con
      // đầu) đều spawn đồng loạt qua telegraph — nên XÓA quái bootstrap
      // đó khỏi mảng enemies ngay tại đây và để tick tiếp theo của
      // tickPacing() tự nhiên queue LẠI toàn bộ wave 0 (kể cả "con #1")
      // qua cơ chế pending/telegraph bình thường. Hơi lãng phí 1 lần roll
      // template thừa (bootstrap đã roll 1 template không dùng tới), chấp
      // nhận được để không phải sửa startBattle()/buildTurnBattle() — 2
      // hàm dùng chung với legacy engine.
      // Despawn bootstrap enemy khỏi EnemySystem (không chỉ turnBattle):
      // nếu chỉ discard khỏi turnBattle.enemies, entity vẫn sống trong
      // EnemySystem và victory-despawn assertion/flow không trống.
      for (const bootstrap of this.turnBattle.enemies) {
        this.enemySystem.despawn(bootstrap.entity.id)
      }
      this.turnBattle.enemies = []
      this.turnBattle.wave = {
        totalEnemyCount: effectiveTotalEnemyCount(stage),
        spawnedCount: 0,
        waves: effectiveWaves(stage),
        waveIndex: 0,
        pendingEnemySpawns: [],
      }

      const stageRef = stage

      this.turnBattleSystem = new TurnBattleSystem(
        this.combatSystem,
        10_000,
        TURN_BUFF_REGISTRY,
        () => {
          // isFinalSpawn: lượt spawn cuối là boss (tầng 10) — factory chạy
          // TRƯỚC khi resolveNextStep tăng spawnedCount, nên tổng đã-spawn
          // sau lần này = spawnedCount + 1.
          const isFinalSpawn = (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= effectiveTotalEnemyCount(stageRef)
          const template =
            this.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn) ??
            this.lastStageEnemyTemplate

          if (!template) {
            throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
          }

          this.lastStageEnemyTemplate = template

          return toTurnBattleParticipant(
            this.placeSpawnedEnemy(enemyToCombatEntity(this.enemySystem.spawn(template))),
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
  // AUTO-FARM HOÀN MỸ (spec 2026-09-04-stage-auto-farm, Task 4)
  // =========================

  /**
   * Bật auto-farm cho 1 stage đã đạt Hoàn Mỹ. Chiếm CÙNG single-slot
   * StageManager với manual/repeat/progress (exclusivity uniform) — không
   * chạy TurnBattleSystem, không hoạt ảnh; reward roll theo wall-clock.
   */
  startAutoFarm(player: PlayerData, stageId: string): boolean {
    if (!player.perfectClearStageIds.includes(stageId)) {
      return false
    }

    if (this.stageManager.get() !== null) {
      return false
    }

    const stage = this.stageTemplates.get(stageId)

    if (!stage) {
      return false
    }

    if (!this.stageManager.start(stage)) {
      return false
    }

    player.autoFarmStage = { stageId, lastCheckedMs: Date.now() }

    return true
  }

  stopAutoFarm(player: PlayerData): void {
    if (player.autoFarmStage === null) {
      return
    }

    player.autoFarmStage = null
    this.stageManager.stop()
  }

  /**
   * Auto-farm Task 5 — offline catch-up khi restore save: roll reward cho
   * các chu kỳ đã trôi ngoài tuyến tính (offline) — NGOẠI LỆ DUY NHẤT
   * combat được nhận reward offline (chùng nguyên tắc Production catch-up).
   * Cùng chu kỳ online (perfectClearSeconds/2); leftover dư giữ lại qua
   * lastCheckedMs tiến đúng phần đã settle.
   *
   * Remediation Task 3 (2026-09-05) — BOUNDED settlement:
   * - elapsedOfflineSeconds clamp theo DEFAULT_MAX_OFFLINE_SECONDS (24h —
   *   NGUỒN DUY NHẤT GameClock, không tự chế cap thứ hai).
   * - cycleSeconds <= 0 / non-finite → no-op an toàn (chặn Infinity cycles
   *   từ malformed save — evidence: infinite-loop timeout trong test).
   */
  settleAutoFarmOffline(player: PlayerData, elapsedOfflineSeconds: number): void {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    const cycleSeconds = player.perfectClearSeconds[autoFarm.stageId]

    if (cycleSeconds === undefined || !(cycleSeconds > 0) || !Number.isFinite(cycleSeconds)) {
      return
    }

    // Clamp theo trần offline chuẩn của game (GameClock 24h).
    const cappedElapsedSeconds = Math.min(
      Math.max(0, elapsedOfflineSeconds),
      DEFAULT_MAX_OFFLINE_SECONDS,
    )

    const cycleMs = (cycleSeconds / 2) * 1000
    const elapsedMs = cappedElapsedSeconds * 1000
    const completedCycles = Math.floor(elapsedMs / cycleMs)

    if (completedCycles <= 0) {
      return
    }

    const stage = this.stageTemplates.get(autoFarm.stageId)

    if (!stage) {
      return
    }

    for (let i = 0; i < completedCycles; i++) {
      this.rollAutoFarmCycleReward(player, stage)
    }

    autoFarm.lastCheckedMs += completedCycles * cycleMs
  }

  /**
   * Tick auto-farm từ fixed-step loop: mỗi chu kỳ hoàn thành roll thẳng
   * reward qua BattleLootSystem shim (không simulation). Leftover partial
   * cycle carry-over qua lastCheckedMs cộng đúng phần đã roll.
   */
  private tickAutoFarm(player: PlayerData) {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    const cycleSeconds = player.perfectClearSeconds[autoFarm.stageId]

    if (cycleSeconds === undefined) {
      return
    }

    const cycleMs = (cycleSeconds / 2) * 1000
    const now = Date.now()
    const elapsedMs = now - autoFarm.lastCheckedMs
    const completedCycles = Math.floor(elapsedMs / cycleMs)

    if (completedCycles <= 0) {
      return
    }

    const stage = this.stageTemplates.get(autoFarm.stageId)

    if (!stage) {
      return
    }

    for (let i = 0; i < completedCycles; i++) {
      this.rollAutoFarmCycleReward(player, stage)
    }

    autoFarm.lastCheckedMs += completedCycles * cycleMs
  }

  /**
   * Roll 1 chu kỳ auto-farm: dựng shim "quái đã chết" theo enemyPool rồi
   * tái dùng processDefeatedEnemies (bounty/heal-on-kill/talent đúng như
   * trận thật) — KHÔNG chạy TurnBattleSystem, không hoạt ảnh.
   */
  private rollAutoFarmCycleReward(player: PlayerData, stage: Stage) {
    this.battleLoot.beginBattle()
    this.battleLoot.setSession(this.buildPlayerRewardReceiver(player), player)

    const killedEntities: { entity: CombatEntity; rewardGranted: boolean }[] = []

    const rollTotalEnemyCount = effectiveTotalEnemyCount(stage)

    for (let i = 0; i < rollTotalEnemyCount; i++) {
      const isFinalSpawn = i === rollTotalEnemyCount - 1
      const template = this.stageWaves.pickEnemyForTurnSpawn(stage, isFinalSpawn)

      if (!template) {
        continue
      }

      const entity = enemyToCombatEntity(this.enemySystem.spawn(template))
      entity.alive = false

      killedEntities.push({ entity, rewardGranted: false })
    }

    // player shim: chỉ processDefeatedEnemies's heal-on-kill branch đọc —
    // entity không alive là placeholder inert (heal-on-kill math inert).
    const shimBattle = {
      player: killedEntities[0]?.entity,
      enemies: killedEntities,
    } as unknown as Battle

    this.battleLoot.processDefeatedEnemies(shimBattle)
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
      this.notifications.push({ kind: 'craft', message: 'Nhi?m v? hï¿½ng ngï¿½y dï¿½ lï¿½m m?i' })
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
        this.getWorkerAssignments(),
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
          message: `${material?.name ?? event.materialId} ï¿½${event.amount}`,
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
            ? `${pill?.name ?? event.pillId} x${event.pills}`
            : `Luy?n ${pill?.name ?? event.pillId} th?t b?i`,
        })
      }

      // Task 14 (rework P4) ï¿½ Tab Phï¿½n Gi?i cycle: khoï¿½ng ? tinh hoa.
      this.decomposeSystem.tick(Date.now())

      for (const entry of this.decomposeSystem.drainOutput()) {
        const tinhHoa = this.materialRegistry.has(entry.materialId)
          ? this.materialRegistry.get(entry.materialId)
          : undefined

        // 9.8 — toast craft hiển thị lượng DELIVERED (trừ tràn); tràn
        // thì push bag.overflow. delivered === 0 → bỏ toast craft.
        const overflow = this.materialBag.add(
          tinhHoa ?? { id: entry.materialId, name: entry.materialId } as never,
          entry.amount,
        )

        const delivered = entry.amount - overflow

        if (delivered > 0) {
          this.notifications.push({
            kind: 'craft',
            message: `Phân Giải +${delivered} ${(tinhHoa as { name?: string } | undefined)?.name ?? 'Tinh Hoa'}`,
          })
        }

        if (overflow > 0) {
          this.notifications.push(
            createBagOverflowEvent(
              (tinhHoa as { name?: string } | undefined)?.name ?? entry.materialId,
              overflow,
            ),
          )
        }
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


    // Turn-based conversion (2026-09-04) ï¿½ cooldownReduction retired;
    // SkillSystem (engine doomed) nh?n 0 thay vï¿½ d?c stat dï¿½ xï¿½a.
    this.skillSystem.update(deltaSeconds, 0)

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

      // Slice 6 cutover — unified flow: Countdown → Spawn (đã có sẵn) →
      // Gauge combat → Wave spawn khi sân trống → Result khi hết wave.
      // Mỗi fixed step 0.1s = 1 pacing tick; turn resolution instant.
      if (this.turnBattle) {
        if (this.presentationGate.isBlocking()) {
          // Defect Task 3 — chờ Phaser mount lần đầu (PresentationGate):
          // không tick countdown/fighting cho tới khi presentation layer
          // sẵn sàng hoặc safety-net timeout trôi qua.
        } else if (this.turnBattle.state === 'countdown') {
          this.turnBattleSystem.tickCountdown(this.turnBattle)

          // Turn-Based Wave Redesign (2026-09-06) — snapshot cũng phải chạy
          // TRONG pha countdown: CombatScene cần countdownProgress mỗi tick
          // để vẽ party telegraph 3→2→1 (reconcileTurnCountdownSpawn). Không
          // emit ở đây thì progress vĩnh viễn không tới scene (callee đã
          // wire, caller im lặng — đúng lớp bug P13).
          emitTurnBattleEntitySnapshot(this.eventBus, this.turnBattle)
        } else if (this.turnBattle.state === 'fighting') {
          // Slice 7 manual mode: trước khi resolve step kế, peek actor —
          // nếu là player VÀ manual mode bật → PAUSE (không resolve, gauge
          // đã advance đúng tới ngưỡng ready bởi peek). Enemy turn và auto
          // mode resolve như thường (auto = cùng engine, không pause).
          if (this.awaitedManualActor) {
            // Paused — still waiting for submitTurnChoice.
          } else if (this.presentationActive && (this.pendingReadyActor || this.pendingDeclaredAction || this.pendingImpact)) {
            // Action Playback Task 6 — waiting for a Phaser acknowledgement,
            // do nothing this tick.
          } else {
            // Gameplay fixes (2026-09-05) — wall-clock pacing: 1 tick = 1
            // gauge-step; Action Playback Task 6 — presentationActive chỉ
            // advance gauge, actor ready vào pendingReadyActor (5-phase
            // machine chờ Phaser acknowledge), headless path resolve ngay.
            const readyActor = this.turnBattleSystem.tickPacing(this.turnBattle, !this.presentationActive)

            if (readyActor !== null && this.presentationActive) {
              // Remediation Task 1 — token mới cho phase ready mới; mọi
              // callback cũ giữ token này sẽ trở thành stale (no-op).
              this.pendingReadyActor = readyActor
              this.playbackToken = this.nextPlaybackToken()

              emitTurnReady(this.eventBus, readyActor.id)
            } else if (readyActor !== null && this.turnBattle.players.includes(readyActor) && this.battleManualMode && !this.awaitedManualActor) {
              this.awaitedManualActor = readyActor
            }
          }

          // Combat Art Pipeline (2026-09-05) — emit LIVE entity snapshot mỗi
          // fixed step trong lúc 'fighting', bất kể nhánh con nào ở trên vừa
          // chạy (pause chờ manual input / chờ Phaser acknowledge / pacing
          // bình thường). Đây là nguồn thay thế bridge 'positions' đã chết
          // của legacy real-time engine — đặt ở CUỐI block 'fighting' để
          // không phụ thuộc nhánh nào bên trên có resolve turn hay không.
          emitTurnBattleEntitySnapshot(this.eventBus, this.turnBattle)
        }
      }

      this.syncLegacyBattleState()

      // Auto-farm Task 4 — roll reward theo wall-clock (trước reward flow
      // thường; auto-farm không có turnBattle nên hai đường không giao).
      if (this.activePlayer) {
        this.tickAutoFarm(this.activePlayer)
      }

      this.grantBattleRewardIfNeeded()
    }

    // Victory event cho stage/turn flow — emit ĐÚNG 1 LẦN mỗi cycle.
    // Single victory terminal: grantTurnBattleRewards() (trong while) la diem
    // duy nhat emit 'battle_end' + record perfect-clear + push completedStageIds.
    // (Block victory trung lap o day da bi XOA 2026-09-04: 2 terminal tranh
    // nhau flag !emitted tung lam record miss — perfect-clear debug evidence.)

    // Auto-repeat: victory + repeat bật → restart NGAY trong cùng call
    // (không chờ step kế) để getBattle()?.state quay lại countdown →
    // fighting tức thì sau khi rewards đã grant — khớp semantics hệ sống
    // (StageWaveSystem restartCycle chạy ngay trong cùng tick victory).
    if (
      this.turnBattle &&
      this.turnBattle.state === 'victory' &&
      this.turnBattleRepeatContinuously &&
      this.activeStageForTurnBattle !== null &&
      this.stageManager.get() !== null
    ) {
      this.restartTurnBattleCycle()
    }

    // Ngoài vòng fixed-step — TribulationDirector tự có catch-up dạng
    // đóng (spec dot-pha-loi-kiep §5.6), chia nhỏ sẽ cộng dồn sai số float.
    this.tribulationDirector.update(deltaSeconds)
  }
  private grantBattleRewardIfNeeded() {
    // Slice 6 cutover: rewards d?c t? TurnBattle (engine duy nh?t). Shim
    // Battle-shape { enemies: [{ entity, rewardGranted }], player } gi?
    // processDefeatedEnemies ho?t d?ng khï¿½ng c?n s?a BattleLootSystem.
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


    // Slice 6 cutover: dựng shim Battle-shape từ TurnBattle để
    // processDefeatedEnemies xử lý bounty/heal-on-kill/talent đúng như hệ
    // cũ mà không sửa BattleLootSystem. rewardGranted flag shim-side.
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

    // Victory/defeat terminal: bắn battle_end (StageWaveSystem.update cũ
    // không chạy nữa — syncLegacyBattleState() set legacy.state trực tiếp
    // khiến update() return sớm trước victory branch). StageManager.active
    // PHẢI được release tại đây: nếu không, startStage() kế tiếp (Đánh Lại)
    // return false vĩnh viễn trong session (smoke-test regression 2026-09-04).
    // Auto-repeat KHÔNG stop — restartTurnBattleCycle tái dùng active.
    if (
      (turnBattle.state === 'victory' || turnBattle.state === 'defeat') &&
      !this.turnBattleEndEmitted
    ) {
      this.turnBattleEndEmitted = true

      if (!this.turnBattleRepeatContinuously) {
        this.stageWaves.stopRepeat()
      }

      if (turnBattle.state === 'victory') {
        this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })


        this.recordPerfectClearIfEligible(turnBattle)

        // Stage completion (StageWaveSystem.update cũ): push completedStageIds
        // ĐÚNG 1 LẦN mỗi stage — auto-repeat vẫn push (player hoàn thành
        // stage này dù đánh tiếp cycle mới).
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

  /** Auto-farm spec Task 3 — wall-clock timestamp lúc bắt đầu stage (chuẩn hoá clearSeconds cho Hoàn Mỹ). */
  private turnBattleStartedAtMs: number | null = null

  /**
   * Auto-farm spec Task 3 (2026-09-04) — Hoàn Mỹ: HP đội mất <=75% VÀ
   * turns < stage.perfectClearTurnLimit → ghi perfectClearStageIds +
   * perfectClearSeconds MỘT LẦN (không overwrite lần đạt đầu).
   */
  /**
   * Auto-farm spec Task 3 (2026-09-04) — record helper marker
   */
  private recordPerfectClearIfEligible(turnBattle: TurnBattle) {
    const stage = this.activeStageForTurnBattle
    const player = this.playerDataForTurnBattle


    if (!stage || !player || stage.perfectClearTurnLimit === undefined) {
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
   * Slice 6 cutover: legacy Battle state MIRROR TurnBattle state — mọi
   * consumer đọc getBattle()?.state (UI gates, tests) thấy đúng pha trận
   * mà không cần biết engine đã đổi. Countdown phase không tồn tại trong
   * turn-based (bỏ) — fighting là pha đầu tiên.
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
  }  /** Repeat-continuously flag từ startStage — driver cho auto-repeat cycle của TurnBattle. */
  private turnBattleRepeatContinuously = false

  private activeStageForTurnBattle: Stage | null = null

  private playerStatsForTurnBattle: Stats | null = null
  private playerDataForTurnBattle: PlayerData | null = null
  /**
   * Vue layer (App.vue's tick()) gọi mỗi tick để rút toast phát sinh
   * TRONG core kể từ lần gọi trước — trả về rồi xoá hàng đợi.
   */
  drainNotifications(): NotificationEvent[] {
    return this.notifications.drain()
  }
}
