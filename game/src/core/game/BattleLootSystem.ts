import type { Battle } from '../battle/Battle'
import type { EventBus } from '../events/EventBus'
import { rollChance, randomInt } from '../reward/DropRoll'
import { BOSS_EQUIPMENT_DROP_CHANCE, NORMAL_EQUIPMENT_DROP_CHANCE, rollMortalEssenceAmount } from '../reward/StageDropRules'
import { getSkillInsightReward } from '../reward/SkillInsightBalance'
import type { RewardReceiver, RewardSystem } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import { createEmptyBattleRewardSummary, type BattleRewardSummary, type BattleRewardItemKind } from '../reward/BattleRewardSummary'
import { composeItemGradeNameSegments, type ItemGrade } from '../item/ItemGrade'
import { composeEquipmentNameSegments } from '../equipment/EquipmentNaming'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import type { PlayerData } from '../player/Player'
import type { EnemyItemDrop } from '../enemy/Enemy'
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

export interface BattleLootSystemDeps {
  eventBus: EventBus
  notifications: NotificationQueue
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

      if (this.receiver) {
        const enemy = this.deps.enemySystem.get(battleEnemy.entity.id)

        if (enemy) {
          // Tu vi giờ CHỈ đến từ tu luyện (2026-08-20) — giết quái
          // KHÔNG còn cộng tu vi nữa, cố ý bỏ qua enemy.rewards.cultivation
          // ở đây (data field vẫn còn trong Enemies.ts nhưng không dùng).
          const equippedTechnique = this.deps.techniqueManager.getEquipped()
          const insightBeforeReward = equippedTechnique?.insight ?? 0

          this.giveReward(this.receiver, { ...enemy.rewards, cultivation: undefined })

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
          const skillInsightGained = getSkillInsightReward(enemy.rewards)

          if (skillInsightGained > 0 && this.player) {
            this.player.skillInsight += skillInsightGained
            this.player.totalSkillInsightGained += skillInsightGained
            this.summary.skillInsight += skillInsightGained
          }

          const spiritStoneGained = enemy.rewards.spiritStone ?? 0
          this.summary.spiritStone += spiritStoneGained

          if (spiritStoneGained > 0) {
            this.emitRewardParticle(battleEnemy.entity.id, 'currency', 0xffd54f)
          }

          this.grantItemDrops(enemy.rewards.itemDrops, battleEnemy.entity.isBoss === true, battleEnemy.entity.id)
          this.grantRandomEquipmentDrop(battleEnemy.entity.isBoss === true, battleEnemy.entity.id)
        }
      }

      this.deps.enemySystem.despawn(battleEnemy.entity.id)
    }

    // Dọn quái đã chết + đã cấp thưởng khỏi mảng — tránh phình vô hạn
    // qua nhiều wave trong cùng 1 stage. Sau bước này battle.enemies
    // chỉ còn quái đang sống, nên "còn quái không" = check .length.
    battle.enemies = battle.enemies.filter(battleEnemy => battleEnemy.entity.alive)
  }

  private giveReward(receiver: RewardReceiver, reward: Reward) {
    this.deps.rewardSystem.give(receiver, reward)
  }

  /**
   * Đồ rơi thẳng vào bag tương ứng ngay khi quái chết. Mỗi lần cộng
   * thành công đẩy 1 toast 'loot' vào NotificationQueue.
   */
  private grantItemDrops(drops: EnemyItemDrop[] | undefined, isBoss: boolean, sourceId: string) {
    if (!drops) {
      return
    }

    for (const drop of drops) {
      if (!rollChance(drop.chance)) {
        continue
      }

      switch (drop.kind) {
        case 'material':
          if (this.deps.materialRegistry.has(drop.itemId)) {
            const material = this.deps.materialRegistry.get(drop.itemId)
            const activeStage = this.deps.stageManager.get()
            const stage = activeStage ? this.deps.stageTemplates.get(activeStage.stageId) : undefined
            const isMortalStageDrop = stage?.requiredRealmId === 'mortal'
              && (stage.floor ?? stage.requiredRealmLevel ?? 0) <= 10
            const amount = drop.itemId === TINH_HOA_PHAM_THE_MATERIAL_ID && isMortalStageDrop
              ? rollMortalEssenceAmount(isBoss)
              : drop.amount ?? 1

            this.deps.materialBag.add(material, amount)
            this.emitRewardParticle(sourceId, 'item', 0x6fbf73)

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

            this.deps.pillBag.add(pill, amount)
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

            const zoneId = activeStageId ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id : undefined

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
              nameSegments: composeEquipmentNameSegments(instance, template, this.deps.zoneRegistry),
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
  }

  private grantRandomEquipmentDrop(isBoss: boolean, sourceId: string) {
    if (!this.player || !rollChance(isBoss ? BOSS_EQUIPMENT_DROP_CHANCE : NORMAL_EQUIPMENT_DROP_CHANCE)) {
      return
    }

    const pool = this.deps.equipmentRegistry.getAll()

    if (pool.length === 0) {
      return
    }

    const template = pool[randomInt(0, pool.length - 1)]!
    const activeStageId = this.deps.stageManager.get()?.stageId
    const zoneId = activeStageId ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id : undefined
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

  private emitRewardParticle(sourceId: string, kind: 'item' | 'insight' | 'currency', color: number) {
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
  private addBattleRewardItem(kind: BattleRewardItemKind, itemId: string, name: string, amount: number) {
    const existing = this.summary.items.find(item => item.kind === kind && item.itemId === itemId)

    if (existing) {
      existing.amount += amount

      return
    }

    this.summary.items.push({ kind, itemId, name, amount })
  }
}
