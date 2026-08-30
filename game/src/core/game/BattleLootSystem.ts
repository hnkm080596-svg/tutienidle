import type { Battle } from '../battle/Battle'
import type { EventBus } from '../events/EventBus'
import { rollChance, randomInt } from '../reward/DropRoll'
import {
  BOSS_EQUIPMENT_DROP_CHANCE,
  NORMAL_EQUIPMENT_DROP_CHANCE,
  rollMortalEssenceAmount,
} from '../reward/StageDropRules'
import { getSkillInsightReward } from '../reward/SkillInsightBalance'
import { getRealmRewardMultiplier } from '../reward/RealmRewardScale'
import {
  getEquipmentDropChanceMultiplier,
  getHealOnKillMaxHpPercent,
  getInsightGainMultiplier,
  getSpiritStoneGainMultiplier,
} from '../talent/TalentEffects'
import { ARTIFACT_STONE_BOSS_QUANTITY_MAX, ARTIFACT_STONE_BOSS_QUANTITY_MIN, ARTIFACT_STONE_DROP_CHANCE } from '../artifact/ArtifactDropBalance'
import { DOAN_BAO_THACH_MATERIAL_ID, applyArtifactExperience, getArtifactExperienceReward } from '../artifact/ArtifactProgression'
import { getRealmIndex } from '../realm/realmSystem'
import type { RewardReceiver, RewardSystem } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import {
  createEmptyBattleRewardSummary,
  type BattleRewardSummary,
  type BattleRewardItemKind,
} from '../reward/BattleRewardSummary'
import { composeItemGradeNameSegments, type ItemGrade } from '../item/ItemGrade'
import { composeEquipmentNameSegments } from '../equipment/EquipmentNaming'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import type { PlayerData } from '../player/Player'

/** Màu tím chuỗi Tinh Hoa Phàm Thể (2026-08-30) — bay về người chơi. */
const ESSENCE_PARTICLE_COLOR = 0xc792ea
import type { Enemy, EnemyItemDrop, EnemyReward } from '../enemy/Enemy'
import type { LootNotificationPresentation } from '../notification/NotificationEvent'
import type { NotificationQueue } from './NotificationQueue'
import type { TemplateRegistry } from './TemplateRegistry'
import type { StageManager } from '../stage/StageManager'
import type { Stage } from '../stage/Stage'
import type { EnemySystem } from '../enemy/EnemySystem'
import type { TechniqueManager } from '../technique/TechniqueManager'
import type { TechniqueSystem } from '../technique/TechniqueSystem'
import type { Technique } from '../technique/Technique'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PillBag } from '../pill/PillBag'
import type { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import type { EquipmentBag } from '../equipment/EquipmentBag'
import type { EquipmentSystem } from '../equipment/EquipmentSystem'
import type { AffixRegistry } from '../equipment/AffixRegistry'
import type { QuestSystem } from '../quest/QuestSystem'
import type { QuestRegistry } from '../quest/QuestRegistry'
import type { QuestManager } from '../quest/QuestManager'
import type { CombatSystem } from '../combat/CombatSystem'
import type { HiddenBeastSystem } from './HiddenBeastSystem'

export interface BattleLootSystemDeps {
  eventBus: EventBus
  notifications: NotificationQueue
  combatSystem: CombatSystem
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag
  equipmentRegistry: EquipmentRegistry
  equipmentBag: EquipmentBag
  equipmentSystem: EquipmentSystem
  affixRegistry: AffixRegistry
  zoneRegistry: ZoneRegistry
  techniqueManager: TechniqueManager
  techniqueSystem: TechniqueSystem
  techniqueTemplates: TemplateRegistry<Technique>
  enemySystem: EnemySystem
  rewardSystem: RewardSystem
  stageManager: StageManager
  stageTemplates: TemplateRegistry<Stage>
  questSystem: QuestSystem
  questRegistry: QuestRegistry
  questManager: QuestManager
  // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — đếm kill Luyện Khí/reset
  // khi giết quái ẩn.
  hiddenBeast: HiddenBeastSystem
}

/**
 * Cấp phần thưởng + loot khi quái chết (2026-08-24, tách khỏi
 * GameManager) — sở hữu:
 * - Session của trận đang diễn ra: ai nhận thưởng (RewardReceiver) và
 *   PlayerData của người chơi (để roll chỉ số chính equipment rớt +
 *   cộng skillInsight). Ephemeral — KHÔNG persist vào save.
 * - BattleRewardSummary tích luỹ trong trận hiện tại cho
 *   CombatVictoryPanel/CombatDefeatPanel (reset mỗi trận MỚI qua
 *   beginBattle()).
 * - grantItemDrops()/grantRandomEquipmentDrop(): đồ rơi thẳng vào bag
 *   tương ứng ngay khi quái chết — không có bước "nhặt" thủ công/loot
 *   window. Mỗi lần cộng thành công đẩy 1 toast 'loot' vào
 *   NotificationQueue (Vue layer drain mỗi tick).
 */
export class BattleLootSystem {
  private summary: BattleRewardSummary = createEmptyBattleRewardSummary()

  // Receiver để phát thưởng khi battle hiện tại kết thúc thắng —
  // xem setSessionReceiver() và processDefeatedEnemies().
  private receiver: RewardReceiver | null = null

  // PlayerData của trận đang diễn ra — cần cho việc roll equipment
  // rớt ra (chỉ số chính scale theo cảnh giới người chơi).
  private player: PlayerData | null = null

  constructor(private readonly deps: BattleLootSystemDeps) {}

  // Reset mỗi khi 1 TRẬN MỚI bắt đầu (startBattle) — xoá cả session.
  beginBattle() {
    this.receiver = null
    this.player = null

    this.summary = createEmptyBattleRewardSummary()
  }

  // startBattleWithPlayer() gọi sau beginBattle().
  setSession(receiver: RewardReceiver, player: PlayerData) {
    this.receiver = receiver
    this.player = player
  }

  /**
   * Khởi tạo session cho trận ĐỘ KIỆP (P2 fix 2026-08-24) — reset TOÀN
   * BỘ state battle-scoped của trận Stage TRƯỚC đó rồi mới gắn player.
   * Trước đây startTribulation() chỉ set player, để lại receiver + reward
   * summary của trận Stage cũ:
   * - getBattleRewardSummary() trả phần thưởng STALE (hiện tại trận Kiếp
   *   không có panel summary nhưng API công khai vẫn đọc được).
   * - receiver cũ còn sống: nếu sau này trận Kiếp có enemy/summon chết
   *   (pendingSummons đã có trong Battle type) thì reward/loot sẽ chảy
   *   qua receiver của phiên trước — hành vi phụ thuộc lịch sử trận đấu.
   * receiver = null là chủ đích: quái Kiếp (nếu có) chết KHÔNG cấp
   * reward/loot — deterministic, không đổi balance của Độ Kiếp.
   */
  beginTribulation(player: PlayerData) {
    this.receiver = null
    this.player = player

    this.summary = createEmptyBattleRewardSummary()
  }

  getSummary(): BattleRewardSummary {
    return this.summary
  }

  /**
   * Nhiều quái có thể chết cùng lúc/liên tục (wave) — quét TOÀN BỘ
   * battle.enemies mỗi tick, cấp thưởng cho con nào vừa chết mà chưa
   * xử lý (rewardGranted là cờ chống lặp thưởng), rồi dọn khỏi mảng.
   * Không còn gate theo battle.state === 'victory' như model 1v1 cũ —
   * quái chết giữa chừng lúc battle vẫn 'fighting' vẫn phải cấp
   * thưởng ngay, không đợi cả trận kết thúc.
   */
  processDefeatedEnemies(battle: Battle) {
    for (const battleEnemy of battle.enemies) {
      if (battleEnemy.entity.alive || battleEnemy.rewardGranted) {
        continue
      }

      battleEnemy.rewardGranted = true

      // Thiên phú Huyết Chiến — diệt quái hồi % max HP (plan §6). Đặt
      // ngoài nhánh receiver để kill nào cũng hồi, kể cả trận không loot.
      // Đi qua combatSystem.applyHealing() để phát 'entity_vitals_changed'
      // (HUD máu cập nhật), không mutate thẳng currentHp như trước.
      const healOnKillPercent = this.player
        ? getHealOnKillMaxHpPercent(this.player.selectedTalentIds)
        : 0

      if (healOnKillPercent > 0 && battle.player.currentHp > 0) {
        this.deps.combatSystem.applyHealing(
          battle.player,
          battle.player.maxHp * healOnKillPercent,
          battle.player.id,
          'healing',
        )
      }

      if (this.receiver) {
        const enemy = this.deps.enemySystem.get(battleEnemy.entity.id)

        if (enemy) {
          // Thiên phú Tụ Bảo — nhân Linh Thạch TRƯỚC khi giveReward để
          // lượng thật vào túi khớp summary (plan §6).
          const talentStoneMultiplier = this.player
            ? getSpiritStoneGainMultiplier(this.player.selectedTalentIds)
            : 1
          // Scale thưởng theo cảnh giới stage (Trúc Cơ ×3, xem
          // RealmRewardScale) — Trúc Cơ tái sử dụng enemyPool Luyện Khí
          // nên phải nhân thưởng để thu nhập không bị khựng. Nhân cả
          // techniqueInsight (tác dụng phụ: artifact EXP + skill insight
          // tăng theo ở Trúc Cơ, đã được duyệt 2026-08-28).
          const realmRewardMultiplier = getRealmRewardMultiplier(enemy.realmId)
          const stoneMultiplier = talentStoneMultiplier * realmRewardMultiplier
          const rewards: EnemyReward =
            stoneMultiplier === 1 && realmRewardMultiplier === 1
              ? enemy.rewards
              : {
                  ...enemy.rewards,
                  spiritStone: enemy.rewards.spiritStone
                    ? Math.floor(enemy.rewards.spiritStone * stoneMultiplier)
                    : enemy.rewards.spiritStone,
                  techniqueInsight: enemy.rewards.techniqueInsight
                    ? Math.floor(enemy.rewards.techniqueInsight * realmRewardMultiplier)
                    : enemy.rewards.techniqueInsight,
                }

          // Tu vi giờ CHỈ đến từ tu luyện (2026-08-20) — EnemyReward
          // không còn field cultivation.
          const equippedTechnique = this.deps.techniqueManager.getEquipped()
          const insightBeforeReward = equippedTechnique?.insight ?? 0

          this.giveReward(this.receiver, rewards)

          // Summary phải phản ánh lượng THẬT SỰ vào Tâm Pháp, kể cả khi
          // không trang bị hoặc đã chạm trần (xem gainEquippedTechniqueInsight()).
          const techniqueInsightGained = Math.max(
            0,
            (equippedTechnique?.insight ?? 0) - insightBeforeReward,
          )
          this.summary.techniqueInsight += techniqueInsightGained

          if (techniqueInsightGained > 0) {
            this.emitRewardParticle(battleEnemy.entity.id, 'insight', 0x78e6d0)
          }

          // Cảm ngộ Kỹ năng — LUÔN cấp thẳng vào player, KHÔNG cần
          // trang bị tâm pháp (khác techniqueInsight ở trên, xem
          // skill-insight-and-auto-combat-hud-plan.md mục 3).
          // Thiên phú Đại Trí Nhược Ngu/Nghịch Thiên nhân tại đây (plan §6).
          const baseSkillInsight = getSkillInsightReward(rewards)
          const skillInsightGained =
            baseSkillInsight > 0 && this.player
              ? Math.floor(baseSkillInsight * getInsightGainMultiplier(this.player.selectedTalentIds))
              : 0

          if (skillInsightGained > 0 && this.player) {
            this.player.skillInsight += skillInsightGained
            this.player.totalSkillInsightGained += skillInsightGained
            this.summary.skillInsight += skillInsightGained
          }

          const spiritStoneGained = rewards.spiritStone ?? 0
          this.summary.spiritStone += spiritStoneGained

          if (spiritStoneGained > 0) {
            this.emitRewardParticle(battleEnemy.entity.id, 'currency', 0xffd54f)
          }

          this.grantItemDrops(
            rewards.itemDrops,
            battleEnemy.entity.isBoss === true,
            battleEnemy.entity.id,
          )
          this.grantRandomEquipmentDrop(battleEnemy.entity.isBoss === true, battleEnemy.entity.id)

          this.grantArtifactStoneDrop(
            enemy,
            battleEnemy.entity.isBoss === true,
            battleEnemy.entity.isElite === true,
            battleEnemy.entity.id,
          )
          this.grantArtifactExperience(enemy)

          const activeStageId = this.deps.stageManager.get()?.stageId
          const zoneId = activeStageId
            ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id
            : undefined

          this.deps.questSystem.onEnemyDefeated(
            this.deps.questRegistry,
            this.deps.questManager,
            battleEnemy.entity.id,
            zoneId,
          )

          // Kiếm Ý vĩnh viễn (spec 2026-08-29-kiem-the-kiem-y mục 3.1) —
          // đếm boss diệt: boss stage (isBoss) + elite/mini-boss (isElite);
          // boss Độ Kiếp đi qua beginTribulation battle (entity isBoss
          // do defineEnemy tribulation template). CHỈ Kiếm Tu route
          // Bạt Kiếm tiêu thụ tầng, nhưng counter đếm cho MỌI path (thống
          // kê vô hại, đổi path muộn không mất tiến trình).
          if (
            this.player &&
            (battleEnemy.entity.isBoss === true || battleEnemy.entity.isElite === true)
          ) {
            this.player.bossKillCount += 1
          }

          // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — đếm kill Luyện Khí;
          // giết Huyết Mông reset cửa sổ về 0.
          if (this.player) {
            this.deps.hiddenBeast.onEnemyDefeated(
              this.player,
              battleEnemy.entity.id,
              enemy.realmId,
            )
          }
        }
      }

      this.deps.enemySystem.despawn(battleEnemy.entity.id)
    }

    // Dọn quái đã chết + đã cấp thưởng khỏi mảng — tránh phình vô hạn
    // qua nhiều wave trong cùng 1 stage. Sau bước này battle.enemies
    // chỉ còn quái đang sống, nên "còn quái không" = check .length.
    battle.enemies = battle.enemies.filter((battleEnemy) => battleEnemy.entity.alive)
  }

  private giveReward(receiver: RewardReceiver, reward: Reward) {
    this.deps.rewardSystem.give(receiver, reward)
  }

  /**
   * Đồ rơi thẳng vào bag tương ứng ngay khi quái chết. Mỗi lần cộng
   * thành công đẩy 1 toast 'loot' vào NotificationQueue. Lượng tràn
   * stack (túi đầy) được gom lại và báo MỘT toast duy nhất cuối đợt
   * thay vì mất lặng lẽ.
   */
  private grantItemDrops(drops: EnemyItemDrop[] | undefined, isBoss: boolean, sourceId: string) {
    if (!drops) {
      return
    }

    const overflowParts: string[] = []

    // Thiên phú Cơ Duyên — chỉ nhân chance của drop kind 'equipment',
    // cap 1.0 (plan §6). Material/pill/technique giữ nguyên.
    const equipmentChanceMultiplier = this.player
      ? getEquipmentDropChanceMultiplier(this.player.selectedTalentIds)
      : 1

    for (const drop of drops) {
      const chance =
        drop.kind === 'equipment'
          ? Math.min(1, drop.chance * equipmentChanceMultiplier)
          : drop.chance

      if (!rollChance(chance)) {
        continue
      }

      switch (drop.kind) {
        case 'material':
          if (this.deps.materialRegistry.has(drop.itemId)) {
            const material = this.deps.materialRegistry.get(drop.itemId)
            const activeStage = this.deps.stageManager.get()
            const stage = activeStage
              ? this.deps.stageTemplates.get(activeStage.stageId)
              : undefined
            const isMortalStageDrop =
              stage?.requiredRealmId === 'mortal' &&
              (stage.floor ?? stage.requiredRealmLevel ?? 0) <= 10
            const amount =
              drop.itemId === TINH_HOA_PHAM_THE_MATERIAL_ID && isMortalStageDrop
                ? rollMortalEssenceAmount(isBoss)
                : (drop.amount ?? 1)

            const materialOverflow = this.deps.materialBag.add(material, amount)

            // Collect-quest hook (review 2026-08-28) — chỉ tính lượng thật
            // sự vào túi (trừ overflow).
            this.deps.questSystem.onMaterialCollected(
              this.deps.questRegistry,
              this.deps.questManager,
              drop.itemId,
              amount - materialOverflow,
            )

            if (materialOverflow > 0) {
              overflowParts.push(`${materialOverflow} ${material.name}`)
            }

            // Tinh Hoa Phàm Thể (2026-08-30) — kind 'essence' riêng: stream
            // tím bay VỀ NGƯỜI CHƠI (combat-essence-stream.ts), mote cuối
            // chạm player mới nạp tiến độ Luyện Thể (App.vue drain). Loot
            // đã vào bag ở trên nên presentation bị bỏ qua không mất gì.
            if (drop.itemId === TINH_HOA_PHAM_THE_MATERIAL_ID) {
              this.emitRewardParticle(sourceId, 'essence', ESSENCE_PARTICLE_COLOR)
            } else {
              this.emitRewardParticle(sourceId, 'item', 0x6fbf73)
            }

            this.pushLootNotification(`+${amount} ${material.name}`, {
              icon: material.icon,
              nameSegments: [{ text: material.name }],
              amountLabel: `+${amount}`,
              accentColorVar: '--jade',
            })
            this.addBattleRewardItem('material', drop.itemId, material.name, amount)
          }
          break

        case 'pill':
          if (this.deps.pillRegistry.has(drop.itemId)) {
            const pill = this.deps.pillRegistry.get(drop.itemId)
            const amount = drop.amount ?? 1

            const pillOverflow = this.deps.pillBag.add(pill, amount)

            if (pillOverflow > 0) {
              overflowParts.push(`${pillOverflow} ${pill.name}`)
            }

            this.emitRewardParticle(sourceId, 'item', this.getGradeParticleColor(pill.grade))

            this.pushLootNotification(`+${amount} ${pill.name}`, {
              icon: pill.icon,
              nameSegments: composeItemGradeNameSegments(pill.name, pill.grade),
              amountLabel: `+${amount}`,
              accentColorVar: `--grade-${pill.grade}`,
            })
            this.addBattleRewardItem('pill', drop.itemId, pill.name, amount)
          }
          break

        case 'equipment':
          if (this.deps.equipmentRegistry.has(drop.itemId) && this.player) {
            const template = this.deps.equipmentRegistry.get(drop.itemId)

            // Địa Giới ghép động (2026-08-15) — Zone chứa Stage đang
            // hoạt động lúc rớt đồ, xem ZoneRegistry.getZoneForStage()/
            // EquipmentNaming.ts. undefined nếu không có Stage đang
            // chạy (không nên xảy ra ở nhánh loot combat này, nhưng
            // graceful nếu có).
            const activeStageId = this.deps.stageManager.get()?.stageId

            const zoneId = activeStageId
              ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id
              : undefined

            const instance = this.deps.equipmentSystem.createInstance(
              template,
              this.player,
              this.deps.affixRegistry,
              zoneId,
            )

            this.deps.equipmentBag.add(instance)
            this.emitRewardParticle(sourceId, 'item', this.getGradeParticleColor(instance.rarity))

            this.pushLootNotification(`+1 ${template.name}`, {
              icon: instance.icon ?? template.icon,
              nameSegments: composeEquipmentNameSegments(
                instance,
                template,
                this.deps.zoneRegistry,
              ),
              amountLabel: '+1',
              accentColorVar: `--eq-quality-${instance.quality}`,
            })
            this.addBattleRewardItem('equipment', template.id, template.name, 1)
          }
          break

        // Phá Cảnh Tâm Pháp — rơi thẳng vào danh sách tâm pháp ĐÃ HỌC
        // (unlocked), giống cách nhặt equipment KHÔNG cần bước
        // "học" riêng như Đan/Phù/Trận. techniqueSystem.learn() tự
        // no-op nếu đã sở hữu (xem TechniqueSystem.ts) — chỉ toast
        // khi THỰC SỰ học mới (learn() trả true), tránh spam toast
        // trùng lặp mỗi lần rớt trúng công pháp đã sở hữu.
        case 'technique': {
          const template = this.deps.techniqueTemplates.get(drop.itemId)

          if (template && this.deps.techniqueSystem.learn(template)) {
            this.emitRewardParticle(sourceId, 'item', 0xffd54f)
            this.pushLootNotification(`Học được: ${template.name}`, {
              icon: template.icon,
              nameSegments: [{ text: template.name }],
              amountLabel: 'Học được',
              accentColorVar: '--gold-500',
            })
            this.addBattleRewardItem('technique', drop.itemId, template.name, 1)
          }

          break
        }
      }
    }

    if (overflowParts.length > 0) {
      const message = `Túi đầy — mất: ${overflowParts.join(', ')}`

      this.deps.notifications.push({
        kind: 'warning',
        message,
        loot: {
          nameSegments: [{ text: message }],
          amountLabel: 'Túi đầy',
          accentColorVar: '--crimson',
        },
      })
    }
  }

  private grantRandomEquipmentDrop(isBoss: boolean, sourceId: string) {
    if (!this.player) {
      return
    }

    // Thiên phú Cơ Duyên — nhân cả chance rơi trang bị ngẫu nhiên
    // (boss lẫn thường), cap 1.0 (plan §6).
    const baseChance = isBoss ? BOSS_EQUIPMENT_DROP_CHANCE : NORMAL_EQUIPMENT_DROP_CHANCE
    const chance = Math.min(
      1,
      baseChance * getEquipmentDropChanceMultiplier(this.player.selectedTalentIds),
    )

    if (!rollChance(chance)) {
      return
    }

    const pool = this.deps.equipmentRegistry.getAll()

    if (pool.length === 0) {
      return
    }

    const template = pool[randomInt(0, pool.length - 1)]!
    const activeStageId = this.deps.stageManager.get()?.stageId
    const zoneId = activeStageId
      ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id
      : undefined
    const instance = this.deps.equipmentSystem.createInstance(
      template,
      this.player,
      this.deps.affixRegistry,
      zoneId,
    )

    this.deps.equipmentBag.add(instance)
    this.emitRewardParticle(sourceId, 'item', this.getGradeParticleColor(instance.rarity))

    // Uncommitted audit followup plan, mục "Đồng nhất thông báo trang bị
    // rơi ngẫu nhiên" (2026-08-24) — nhánh drop này trước đây thiếu
    // pushLootNotification() so với nhánh 'equipment' của grantItemDrops()
    // ở trên (cùng formatter tên/icon/màu Phẩm), khiến rớt đồ ngẫu nhiên
    // (BOSS/NORMAL_EQUIPMENT_DROP_CHANCE, KHÔNG khai trong enemy.rewards.itemDrops)
    // không hiện toast dù đã cộng bag + particle + battle summary.
    this.pushLootNotification(`+1 ${template.name}`, {
      icon: instance.icon ?? template.icon,
      nameSegments: composeEquipmentNameSegments(instance, template, this.deps.zoneRegistry),
      amountLabel: '+1',
      accentColorVar: `--eq-quality-${instance.quality}`,
    })
    this.addBattleRewardItem('equipment', template.id, template.name, 1)
  }

  /**
   * Đoán Bảo Thạch (doc §6) — chỉ roll khi quái Trúc Cơ trở lên. Mỗi
   * quái chỉ dùng đúng MỘT dòng cao nhất (Boss KHÔNG roll thêm bảng
   * Elite/Thường). Mirror nhánh 'material' của grantItemDrops() ở trên
   * cho cách cộng bag/notification/summary.
   */
  private grantArtifactStoneDrop(enemy: Enemy, isBoss: boolean, isElite: boolean, sourceId: string) {
    if (getRealmIndex(enemy.realmId) < getRealmIndex('foundation_establishment')) {
      return
    }

    if (!this.deps.materialRegistry.has(DOAN_BAO_THACH_MATERIAL_ID)) {
      return
    }

    const chance = isBoss
      ? ARTIFACT_STONE_DROP_CHANCE.boss
      : isElite
        ? ARTIFACT_STONE_DROP_CHANCE.elite
        : ARTIFACT_STONE_DROP_CHANCE.normal

    if (!rollChance(chance)) {
      return
    }

    const amount = isBoss
      ? randomInt(ARTIFACT_STONE_BOSS_QUANTITY_MIN, ARTIFACT_STONE_BOSS_QUANTITY_MAX)
      : 1

    const material = this.deps.materialRegistry.get(DOAN_BAO_THACH_MATERIAL_ID)

    const stoneOverflow = this.deps.materialBag.add(material, amount)

    this.deps.questSystem.onMaterialCollected(
      this.deps.questRegistry,
      this.deps.questManager,
      DOAN_BAO_THACH_MATERIAL_ID,
      amount - stoneOverflow,
    )

    this.emitRewardParticle(sourceId, 'item', 0x6fbf73)

    this.pushLootNotification(`+${amount} ${material.name}`, {
      icon: material.icon,
      nameSegments: [{ text: material.name }],
      amountLabel: `+${amount}`,
      accentColorVar: '--jade',
    })
    this.addBattleRewardItem('material', DOAN_BAO_THACH_MATERIAL_ID, material.name, amount)
  }

  /**
   * EXP Bản Mệnh Pháp Bảo (doc §5.2) — cùng nguồn/nhịp per-kill với
   * skillInsight ở trên (cộng THẲNG vào player.artifact, KHÔNG qua
   * RewardReceiver/RewardSystem — đây là hồ điểm riêng, không cần
   * trang bị/sở hữu gì khác để nhận, giống skillInsight).
   */
  private grantArtifactExperience(enemy: Enemy) {
    if (!this.player?.artifact) {
      return
    }

    const amount = getArtifactExperienceReward(enemy)

    applyArtifactExperience(this.player.artifact, amount, this.player.realmLevel)

    this.summary.artifactInsight += amount
  }

  private emitRewardParticle(
    sourceId: string,
    kind: 'item' | 'insight' | 'currency' | 'essence',
    color: number,
  ) {
    this.deps.eventBus.emit('reward_particle', { sourceId, kind, color })
  }

  private pushLootNotification(message: string, loot: LootNotificationPresentation) {
    this.deps.notifications.push({ kind: 'loot', message, loot })
  }

  private getGradeParticleColor(grade: ItemGrade): number {
    const colors: Record<ItemGrade, number> = {
      hoang: 0x8a877e,
      huyen: 0x6fbf73,
      dia: 0x5b9bd5,
      thien: 0xffd54f,
      tien: 0xfff6d8,
    }

    return colors[grade]
  }

  // Gộp theo itemId+kind (nhiều wave cùng trận có thể rớt trùng loại)
  // thay vì đẩy 1 dòng riêng mỗi lần rớt — CombatVictoryPanel hiện
  // "+N tên vật phẩm" gọn, không lặp dòng.
  private addBattleRewardItem(
    kind: BattleRewardItemKind,
    itemId: string,
    name: string,
    amount: number,
  ) {
    const existing = this.summary.items.find((item) => item.kind === kind && item.itemId === itemId)

    if (existing) {
      existing.amount += amount

      return
    }

    this.summary.items.push({ kind, itemId, name, amount })
  }
}
