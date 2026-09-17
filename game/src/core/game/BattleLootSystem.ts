import type { CombatEntity } from '../combat/CombatEntity'
import type { EventBus } from '../events/EventBus'
import { randomInt } from '../reward/DropRoll'
import { getSkillInsightReward } from '../reward/SkillInsightBalance'
import { getRealmRewardMultiplier } from '../reward/RealmRewardScale'
import {
  getHealOnKillMaxHpPercent,
  getInsightGainMultiplier,
  getSpiritStoneGainMultiplier,
} from '../talent/TalentEffects'
import { applyArtifactExperience, getArtifactExperienceReward } from '../artifact/ArtifactProgression'
import { applyCompanionExp, companionBattleExpPerKill } from '../companion/CompanionProgression'
import { resolvePartyFormation } from './FormationPlacement'
import { resolveDrops, type DropChannel, type ResolvedDropItem } from '../drop/resolveDrops'
import { modifiersFor } from '../drop/DropContext'
import { stageDropTableFor } from '../../data/drop/StageDropTables'
import { familyDropTableFor } from '../../data/drop/FamilyDropTables'
import type { RewardReceiver, RewardSystem } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import {
  createEmptyBattleRewardSummary,
  type BattleRewardSummary,
  type BattleRewardItemKind,
} from '../reward/BattleRewardSummary'
import { composeItemGradeNameSegments, type ItemGrade } from '../item/ItemGrade'
import type { ItemQuality } from '../item/ItemQuality'
import { composeEquipmentDisplayName } from '../equipment/EquipmentNaming'
import { getProfessionGradeForRealm } from '../profession/ProfessionGrade'
import { itemQualityRank, professionGradeRank } from '../profession/slotRank'
import { gradeLabel } from '../presentation/labels'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import type { PlayerData } from '../player/Player'

/** Màu tím chuỗi Tinh Hoa Phàm Thể (2026-08-30) — bay về người chơi. */
const ESSENCE_PARTICLE_COLOR = 0xc792ea
import type { Enemy, EnemyReward } from '../enemy/Enemy'
import type { LootNotificationPresentation } from '../notification/NotificationEvent'
import type { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
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
import type { EquipmentBag, AutoDissolveReward } from '../equipment/EquipmentBag'
import type { EquipmentSystem } from '../equipment/EquipmentSystem'
import type { AffixRegistry } from '../equipment/AffixRegistry'
import type { QuestSystem } from '../quest/QuestSystem'
import type { QuestRegistry } from '../quest/QuestRegistry'
import type { QuestManager } from '../quest/QuestManager'
import type { CombatSystem } from '../combat/CombatSystem'
import type { HiddenBeastSystem } from './HiddenBeastSystem'

/**
 * One enemy awaiting reward processing: the entity plus its once-only
 * grant flag. Deliberately narrower than BattleEnemy (no combat
 * timers/buffs) and than Battle (no player/state) so non-battle reward
 * paths - the auto-farm idle roll - hand over honest inputs instead of
 * fabricating a whole Battle (F3, 2026-09-13).
 */
export interface RewardPendingEnemy {
  entity: CombatEntity
  rewardGranted: boolean
}

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
 * - grantResolvedDrops(): đồ rơi thẳng vào bag tương ứng ngay khi quái
 *   chết — không có bước "nhặt" thủ công/loot window. Mỗi lần cộng
 *   thành công đẩy 1 toast 'loot' vào NotificationQueue (Vue layer
 *   drain mỗi tick).
 * - Drop-system (2026-09-12): QUYẾT ĐỊNH rơi gì thuộc resolveDrops()
 *   (stage/family table + signature + modifiers) — hệ này chỉ orchestrate
 *   cấp phát + notification, không tự roll thêm đường nào.
 */
export class BattleLootSystem {
  private summary: BattleRewardSummary = createEmptyBattleRewardSummary()

  // Receiver để phát thưởng khi battle hiện tại kết thúc thắng —
  // xem setSessionReceiver() và processDefeatedEnemies().
  private receiver: RewardReceiver | null = null

  // PlayerData của trận đang diễn ra — cần cho việc roll equipment
  // rớt ra (chỉ số chính scale theo cảnh giới người chơi).
  private player: PlayerData | null = null

  // Kênh drop hiện tại — 'active' mặc định; auto-farm idle bật 'idle'
  // qua setChannel() rồi khôi phục sau mỗi cycle (Task 9 wiring).
  private channel: DropChannel = 'active'

  constructor(private readonly deps: BattleLootSystemDeps) {}

  setChannel(channel: DropChannel) {
    this.channel = channel
  }

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
   * Nhiều quái có thể chết cùng lúc/liên tục (wave) -- quét TOÀN BỘ
   * `enemies` mỗi tick, cấp thưởng cho con nào vừa chết mà chưa
   * xử lý (rewardGranted là cờ chống lặp thưởng), rồi dọn khỏi mảng
   * in-place. Không còn gate theo battle.state === 'victory' như model
   * 1v1 cũ -- quái chết giữa chừng lúc battle vẫn 'fighting' vẫn phải
   * cấp thưởng ngay, không đợi cả trận kết thúc.
   *
   * `healTarget` (F3, 2026-09-13) is the entity heal-on-kill applies to:
   * a real battle passes its live player entity; the auto-farm idle
   * channel passes null (no player entity is fighting) instead of
   * standing a dead enemy in as `player`.
   */
  processDefeatedEnemies(
    enemies: RewardPendingEnemy[],
    healTarget: CombatEntity | null,
    stageOverride?: Stage,
  ) {
    for (const battleEnemy of enemies) {
      if (battleEnemy.entity.alive || battleEnemy.rewardGranted) {
        continue
      }

      battleEnemy.rewardGranted = true

      // Thiên phú Huyết Chiến — diệt quái hồi % max HP (plan §6). Đặt
      // ngoài nhánh receiver để kill nào cũng hồi, kể cả trận không loot.
      // Đi qua combatSystem.applyHealing() để phát 'entity_vitals_changed'
      // (HUD máu cập nhật), không mutate thẳng currentHp như trước.
      // healTarget = null is a deliberate opt-out (auto-farm idle).
      const healOnKillPercent = this.player
        ? getHealOnKillMaxHpPercent(this.player.selectedTalentIds)
        : 0

      if (healOnKillPercent > 0 && healTarget !== null && healTarget.currentHp > 0) {
        this.deps.combatSystem.applyHealing(
          healTarget,
          healTarget.maxHp * healOnKillPercent,
          healTarget.id,
          'healing',
        )
      }

      if (this.receiver) {
        const enemy = this.deps.enemySystem.get(battleEnemy.entity.id)

        if (enemy) {
          // Drop-system (2026-09-12): resolveDrops owns the WHAT (stage
          // table by realm+floor, family table, per-enemy signatures,
          // boss/elite/tag modifiers). This system owns the HOW (bags,
          // toasts, particles, summary, quest hooks).
          const activeStage = stageOverride ? undefined : this.deps.stageManager.get()
          const stage =
            stageOverride ??
            (activeStage ? this.deps.stageTemplates.get(activeStage.stageId) : undefined)
          const drops = resolveDrops({
            // Stage band is the progression anchor; a kill with no stage
            // context (auto-farm shim, debug/startBattleWithPlayer fights)
            // falls back to the enemy's own realm band rather than paying
            // nothing.
            stageTable: stageDropTableFor(stage?.requiredRealmId ?? enemy.realmId, stage?.floor),
            familyTable: familyDropTableFor(enemy.family),
            signatureDrops: enemy.signatureDrops,
            modifiers: modifiersFor({
              channel: this.channel,
              isBoss: battleEnemy.entity.isBoss === true,
              isElite: battleEnemy.entity.isElite === true,
            }),
            channel: this.channel,
          })

          // Thiên phú Tụ Bảo — nhân Linh Thạch TRƯỚC khi giveReward để
          // lượng thật vào túi khớp summary (plan §6).
          const talentStoneMultiplier = this.player
            ? getSpiritStoneGainMultiplier(this.player.selectedTalentIds)
            : 1
          // Scale thưởng theo cảnh giới stage (Trúc Cơ ×3, xem
          // RealmRewardScale) — Trúc Cơ tái sử dụng enemyPool Luyện Khí
          // nên phải nhân thưởng để thu nhập không bị khựng. Nhân cả
          // techniqueInsight (tác dụng phụ: artifact EXP + skill insight
          // tăng theo ở Trúc Cơ, đã được duyệt 2026-08-28). Currency now
          // comes from the stage drop table (already multiplied by the
          // modifier currency coefficient inside resolveDrops) — the
          // realm/talent multipliers keep their position AFTER it.
          const realmRewardMultiplier = getRealmRewardMultiplier(enemy.realmId)
          const stoneMultiplier = talentStoneMultiplier * realmRewardMultiplier
          const rewards: EnemyReward = {
            spiritStone: Math.floor(drops.spiritStone * stoneMultiplier),
            techniqueInsight: Math.floor(drops.techniqueInsight * realmRewardMultiplier),
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

          this.grantResolvedDrops(
            drops.items,
            drops.qualityBonusSteps,
            battleEnemy.entity.id,
          )

          this.grantArtifactExperience(enemy)

          // Companion battle EXP (companion-gacha spec section 7,
          // 2026-09-12): every companion assigned in the resolved party
          // formation gains exp per kill, scaled by the stage realm - the
          // same anchor as the drop table above, so a kill with no stage
          // context falls back to enemy.realmId. The formation is
          // re-resolved per kill (snapshot semantics): a mid-battle
          // formation change only affects the NEXT kill.
          const player = this.player
          if (player && player.companions.length > 0) {
            const expPerKill = companionBattleExpPerKill(
              stage?.requiredRealmId ?? enemy.realmId,
            )

            // Exactly-once per companion per kill: a malformed loadout
            // can assign the same combatantId to two slots (the save
            // validator does not inspect assignments), but combat itself
            // spawns only one participant per definitionId.
            const grantedCombatantIds = new Set<string>(['player'])
            for (const slot of resolvePartyFormation(player)) {
              if (grantedCombatantIds.has(slot.combatantId)) {
                continue
              }
              grantedCombatantIds.add(slot.combatantId)

              const companionIndex = player.companions.findIndex(
                (companion) => companion.definitionId === slot.combatantId,
              )
              const companion =
                companionIndex >= 0 ? player.companions[companionIndex] : undefined

              if (!companion) {
                continue
              }

              // applyCompanionExp already clamps at the player-realm
              // ceiling - no level-maxed pre-check here.
              player.companions[companionIndex] = applyCompanionExp(
                companion,
                expPerKill,
                player.realmId,
              ).instance
            }
          }

          const activeStageId = this.deps.stageManager.get()?.stageId
          const zoneId = activeStageId
            ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id
            : undefined

          // Mission E Task 1 (audit T3-16): consumers match TEMPLATE
          // ids; the instance id is uuid-minted. The ?? id fallback
          // keeps raw-template records (never passed through spawn)
          // working.
          const defeatedTemplateId = battleEnemy.entity.templateId ?? battleEnemy.entity.id

          this.deps.questSystem.onEnemyDefeated(
            this.deps.questRegistry,
            this.deps.questManager,
            defeatedTemplateId,
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
              defeatedTemplateId,
              enemy.realmId,
            )
          }
        }
      }

      this.deps.enemySystem.despawn(battleEnemy.entity.id)
    }

    // Dọn quái đã chết + đã cấp thưởng khỏi mảng -- tránh phình vô hạn
    // qua nhiều wave trong cùng 1 stage. In-place splice: the same
    // postcondition the old `battle.enemies = filter(alive)` gave -- sau
    // bước này `enemies` chỉ còn quái đang sống, nên "còn quái không" =
    // check .length.
    for (let i = enemies.length - 1; i >= 0; i--) {
      const entry = enemies[i]
      if (entry && !entry.entity.alive) {
        enemies.splice(i, 1)
      }
    }
  }

  private giveReward(receiver: RewardReceiver, reward: Reward) {
    this.deps.rewardSystem.give(receiver, reward)
  }

  /**
   * Đồ rơi thẳng vào bag tương ứng ngay khi quái chết — consume phần
   * `items` resolveDrops đã quyết định (KHÔNG roll thêm gì ở đây; chỉ
   * 'equipment_any' còn 1 lần rút template từ registry vì resolver
   * không biết registry). Mỗi lần cộng thành công đẩy 1 toast 'loot'
   * vào NotificationQueue. Lượng tràn stack (túi đầy) được gom lại và
   * báo MỘT toast duy nhất cuối đợt thay vì mất lặng lẽ.
   */
  private grantResolvedDrops(
    items: ResolvedDropItem[],
    qualityBonusSteps: number,
    sourceId: string,
  ) {
    const overflowParts: string[] = []

    // Địa Giới ghép động (2026-08-15) — Zone chứa Stage đang hoạt động
    // lúc rớt đồ, xem ZoneRegistry.getZoneForStage()/EquipmentNaming.ts.
    const activeStageId = this.deps.stageManager.get()?.stageId
    const zoneId = activeStageId
      ? this.deps.zoneRegistry.getZoneForStage(activeStageId)?.id
      : undefined

    const grantEquipment = (templateId: string | undefined) => {
      if (!this.player) {
        return
      }

      const template = templateId
        ? this.deps.equipmentRegistry.has(templateId)
          ? this.deps.equipmentRegistry.get(templateId)
          : undefined
        : (() => {
            const pool = this.deps.equipmentRegistry.getAll()

            return pool.length > 0 ? pool[randomInt(0, pool.length - 1)] : undefined
          })()

      if (!template) {
        return
      }

      const instance = this.deps.equipmentSystem.createInstance(
        template,
        this.player,
        this.deps.affixRegistry,
        zoneId,
        qualityBonusSteps,
      )

      this.grantAutoDissolveRewards(this.deps.equipmentBag.add(instance))
      this.emitRewardParticle(sourceId, 'item', this.getQualityParticleColor(instance.quality))

      this.pushLootNotification(`+1 ${template.name}`, {
        icon: instance.icon ?? template.icon,
        name: composeEquipmentDisplayName(instance, template, this.deps.zoneRegistry),
        // Single-color name on the Chat ramp (spec section 2): quality rank
        // spread onto odd steps of the 10-step --rank-color scale.
        nameColorVar: `--rank-color-${itemQualityRank(instance.quality) * 2 - 1}`,
        nameTone: instance.quality === 'tien' ? 'tien' : undefined,
        gradeLabel: gradeLabel(instance.grade),
        amountLabel: '+1',
        // Fix 2 follow-up (final review, optional minor) — dùng
        // --grade-${quality} thay vì tự tính lại rank-color-N (dup logic
        // ITEM_QUALITY_ORDER.indexOf).
        accentColorVar: `--grade-${instance.quality}`,
      })
      this.addBattleRewardItem('equipment', template.id, template.name, 1)
    }

    for (const drop of items) {
      switch (drop.kind) {
        case 'material':
          if (drop.itemId && this.deps.materialRegistry.has(drop.itemId)) {
            const material = this.deps.materialRegistry.get(drop.itemId)
            const amount = drop.amount

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

            // Material Pham axis = profession realm -> grade -> rank on
            // the 10-step scale (same lookup MaterialBagSection uses);
            // no profession meta => no name color / grade suffix.
            const materialGrade = material.profession?.realmId
              ? getProfessionGradeForRealm(material.profession.realmId)
              : undefined
            const materialRank = materialGrade ? professionGradeRank(materialGrade) : undefined

            this.pushLootNotification(`+${amount} ${material.name}`, {
              icon: material.icon,
              name: material.name,
              nameColorVar: materialRank !== undefined ? `--rank-color-${materialRank}` : undefined,
              gradeLabel: materialGrade ? gradeLabel(materialGrade) : undefined,
              amountLabel: `+${amount}`,
              accentColorVar: '--jade',
            })
            this.addBattleRewardItem('material', drop.itemId, material.name, amount)
          }
          break

        case 'pill':
          if (drop.itemId && this.deps.pillRegistry.has(drop.itemId)) {
            const pill = this.deps.pillRegistry.get(drop.itemId)
            const amount = drop.amount

            const pillOverflow = this.deps.pillBag.add(pill, amount)

            if (pillOverflow > 0) {
              overflowParts.push(`${pillOverflow} ${pill.name}`)
            }

            this.emitRewardParticle(sourceId, 'item', this.getGradeParticleColor(pill.grade))

            this.pushLootNotification(`+${amount} ${pill.name}`, {
              icon: pill.icon,
              // Full "{Chat} - {Name}" display name (spec section 2); color =
              // Pham ramp when the pill carries professionGrade, else
              // the Chat --grade-* var. professionGrade is optional on
              // Pill, so the grade suffix is gated on it.
              name: composeItemGradeNameSegments(pill.name, pill.grade)
                .map((segment) => segment.text)
                .join(' '),
              nameColorVar: pill.professionGrade
                ? `--rank-color-${professionGradeRank(pill.professionGrade)}`
                : `--grade-${pill.grade}`,
              nameTone: pill.grade === 'tien' ? 'tien' : undefined,
              gradeLabel: pill.professionGrade ? gradeLabel(pill.professionGrade) : undefined,
              amountLabel: `+${amount}`,
              accentColorVar: `--grade-${pill.grade}`,
            })
            this.addBattleRewardItem('pill', drop.itemId, pill.name, amount)
          }
          break

        case 'equipment':
          grantEquipment(drop.itemId)
          break

        // 'equipment_any' — resolver trả về không kèm itemId; rút ngẫu
        // nhiên 1 template từ registry (đường "rơi đồ ngẫu nhiên" cũ).
        case 'equipment_any':
          grantEquipment(undefined)
          break

        // Phá Cảnh Tâm Pháp — rơi thẳng vào danh sách tâm pháp ĐÃ HỌC
        // (unlocked), giống cách nhặt equipment KHÔNG cần bước
        // "học" riêng như Đan/Phù/Trận. techniqueSystem.learn() tự
        // no-op nếu đã sở hữu (xem TechniqueSystem.ts) — chỉ toast
        // khi THỰC SỰ học mới (learn() trả true), tránh spam toast
        // trùng lặp mỗi lần rớt trúng công pháp đã sở hữu.
        case 'technique': {
          const itemId = drop.itemId
          const template = itemId ? this.deps.techniqueTemplates.get(itemId) : undefined

          if (itemId && template && this.deps.techniqueSystem.learn(template)) {
            this.emitRewardParticle(sourceId, 'item', 0xffd54f)
            this.pushLootNotification(`Học được: ${template.name}`, {
              icon: template.icon,
              name: template.name,
              amountLabel: 'Học được',
              accentColorVar: '--gold-500',
            })
            this.addBattleRewardItem('technique', itemId, template.name, 1)
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
          name: message,
          amountLabel: 'Túi đầy',
          accentColorVar: '--crimson',
        },
      })
    }
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

  /**
   * Cap mềm túi trang bị (audit 2026-08-31) — EquipmentBag.add() tự Hóa
   * Luyện item "rác" nhất khi vượt cap và TRẢ rewards Tinh Hoa cho
   * caller cộng. Null-safe với mock tests (add trả undefined khi bị
   * mock). Cộng qua materialBag + quest hook như nhánh 'material',
   * toast 1 lần mỗi batch qua NotificationQueue sẵn có.
   */
  private grantAutoDissolveRewards(rewards: AutoDissolveReward[] | undefined) {
    const autoDissolved = rewards ?? []

    if (autoDissolved.length === 0) {
      return
    }

    for (const reward of autoDissolved) {
      if (!this.deps.materialRegistry.has(reward.materialId)) {
        continue
      }

      // 9.8 — tràn túi: quest chỉ tính delivered + toast bag.overflow.
      const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(reward.materialId), reward.amount)

      this.deps.questSystem.onMaterialCollected(
        this.deps.questRegistry,
        this.deps.questManager,
        reward.materialId,
        reward.amount - overflow,
      )

      if (overflow > 0) {
        this.deps.notifications.push(
          createBagOverflowEvent(this.deps.materialRegistry.get(reward.materialId).name, overflow),
        )
      }
    }

    this.pushLootNotification(`Túi đầy — tự Hóa Luyện ${autoDissolved.length} món thành Tinh Hoa`, {
      name: 'Tự Hóa Luyện',
      amountLabel: `-${autoDissolved.length}`,
      accentColorVar: '--jade',
    })
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

  private getQualityParticleColor(quality: ItemQuality): number {
    const colors: Record<ItemQuality, number> = {
      hoang: 0x8a877e,
      huyen: 0x6fbf73,
      dia: 0x5b9bd5,
      thien: 0xffd54f,
      tien: 0xfff6d8,
    }

    return colors[quality]
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
