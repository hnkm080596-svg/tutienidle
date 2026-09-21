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

// ItemGrade and ItemQuality are the same 5-member union - one table.
const RANK_PARTICLE_COLORS: Record<ItemGrade, number> = {
  hoang: 0x8a877e,
  huyen: 0x6fbf73,
  dia: 0x5b9bd5,
  thien: 0xffd54f,
  tien: 0xfff6d8,
}
import type { Enemy, EnemyReward } from '../enemy/Enemy'
import type { LootNotificationPresentation } from '../notification/NotificationEvent'
import type { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import type { TemplateRegistry } from './TemplateRegistry'
import type { StageManager } from '../stage/StageManager'
import type { Stage } from '../stage/Stage'
import type { EnemySystem } from '../enemy/EnemySystem'
import type { TechniqueSystem } from '../technique/TechniqueSystem'
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
  techniqueSystem: TechniqueSystem
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
 * Cap phan thuong + loot khi quai chet (2026-08-24, tach khoi
 * GameManager) - so huu:
 * - Session cua tran dang dien ra: ai nhan thuong (RewardReceiver) va
 *   PlayerData cua nguoi choi (de roll chi so chinh equipment rot +
 *   cong skillInsight). Ephemeral - KHONG persist vao save.
 * - BattleRewardSummary tich luy trong tran hien tai cho
 *   CombatVictoryPanel/CombatDefeatPanel (reset moi tran MOI qua
 *   beginBattle()).
 * - grantResolvedDrops(): do roi thang vao bag tuong ung ngay khi quai
 *   chet - khong co buoc "nhat" thu cong/loot window. Moi lan cong
 *   thanh cong day 1 toast 'loot' vao NotificationQueue (Vue layer
 *   drain moi tick).
 * - Drop-system (2026-09-12): QUYET DINH roi gi thuoc resolveDrops()
 *   (stage/family table + signature + modifiers) - he nay chi orchestrate
 *   cap phat + notification, khong tu roll them duong nao.
 * - P7-M3: techniqueMastery la kenh PENDING - kill cong don, chi
 *   settleTechniqueMastery() (victory terminal / per auto-farm cycle)
 *   moi flush qua TechniqueSystem.gainMastery. Consume-and-zero vi
 *   repeat cycle giu loot session (preserveLootSession: beginBattle
 *   bi skip) - khong consume thi cycle sau tra lai cung buffer.
 */
export class BattleLootSystem {
  private summary: BattleRewardSummary = createEmptyBattleRewardSummary()

  // Receiver để phát thưởng khi battle hiện tại kết thúc thắng —
 // xem setSessionReceiver() v- processDefeatedEnemies().
  private receiver: RewardReceiver | null = null

  // PlayerData của trận đang diễn ra — cần cho việc roll equipment
  // rớt ra (chỉ số chính scale theo cảnh giới người chơi).
  private player: PlayerData | null = null

  // Kênh drop hiện tại — 'active' mặc định; auto-farm idle bật 'idle'
  // qua setChannel() rồi khôi phục sau mỗi cycle (Task 9 wiring).
  private channel: DropChannel = 'active'

  // P7-M3 - technique mastery tich luy theo kill, flush MOT lan o
  // terminal (victory) hoac cuoi moi auto-farm cycle. Defeat KHONG
  // flush - buffer vut di voi session.
  private pendingTechniqueMastery = 0

  /**
  * P6 - loot/drop RNG seam. Economy randomness deliberately stays off
   * the BATTLE rng (a seeded battle must not pin drops), but deterministic
   * sessions still need replayable reward settlement: a session injects
   * its own seeded stream here. Lazy Math.random default keeps test
   * spies intercepting and production behavior unchanged.
   */
  private lootRng: () => number = () => Math.random()

  setLootRng(rng: (() => number) | undefined): void {
    this.lootRng = rng ?? (() => Math.random())
  }

  constructor(private readonly deps: BattleLootSystemDeps) {}

  setChannel(channel: DropChannel) {
    this.channel = channel
  }

 // Reset m-i khi 1 TR-N M-I b-t --u (startBattle) - xo- c- session.
  beginBattle() {
    this.receiver = null
    this.player = null
    this.pendingTechniqueMastery = 0

    this.summary = createEmptyBattleRewardSummary()
  }

  /**
   * P7-M3 - flush pending technique mastery vao canonical technique
   * qua TechniqueSystem.gainMastery. Consume-and-zero TRUOC khi goi:
   * repeat cycles giu loot session (beginBattle bi skip) nen buffer
   * con lai se bi tra lai o victory ke. Summary chi ghi luong THAT SU
   * duoc tieu thu (gained) - rank-cap clipping khong inflate so lieu.
   */
  settleTechniqueMastery(sourceId?: string) {
    const amount = this.pendingTechniqueMastery
    this.pendingTechniqueMastery = 0

    if (amount <= 0) {
      return
    }

    const { gained } = this.deps.techniqueSystem.gainMastery(amount)
    this.summary.techniqueMastery += gained

    if (gained > 0 && sourceId) {
      this.emitRewardParticle(sourceId, 'insight', 0x78e6d0)
    }
  }

  // startBattleWithPlayer() gọi sau beginBattle().
  setSession(receiver: RewardReceiver, player: PlayerData) {
    this.receiver = receiver
    this.player = player
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
          const activeStage = stageOverride ? undefined : this.deps.stageManager.getActive()
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
            rng: () => this.lootRng(),
          })

          // Thiên phú Tụ Bảo — nhân Linh Thạch TRƯỚC khi giveReward để
          // lượng thật vào túi khớp summary (plan §6).
          const talentStoneMultiplier = this.player
            ? getSpiritStoneGainMultiplier(this.player.selectedTalentIds)
            : 1
          // Scale thưởng theo cảnh giới stage (Trúc Cơ ×3, xem
          // RealmRewardScale) — Trúc Cơ tái sử dụng enemyPool Luyện Khí
          // nên phải nhân thưởng để thu nhập không bị khựng. Nhân cả
          // techniqueMastery (tac dung phu: artifact EXP + skill insight
          // tăng theo ở Trúc Cơ, đã được duyệt 2026-08-28). Currency now
          // comes from the stage drop table (already multiplied by the
          // modifier currency coefficient inside resolveDrops) — the
          // realm/talent multipliers keep their position AFTER it.
          const realmRewardMultiplier = getRealmRewardMultiplier(enemy.realmId)
          const stoneMultiplier = talentStoneMultiplier * realmRewardMultiplier
          const rewards: EnemyReward = {
            spiritStone: Math.floor(drops.spiritStone * stoneMultiplier),
            techniqueMastery: Math.floor(drops.techniqueMastery * realmRewardMultiplier),
          }

          // P7-M3 - technique mastery gom PENDING, KHONG cap ngay: chi
          // settleTechniqueMastery() (victory / auto-farm cycle) moi
          // flush qua gainMastery. Defeat giu buffer toi luc session
          // vut - khong tra.
          this.pendingTechniqueMastery += rewards.techniqueMastery

          // Tu vi giờ CHỈ đến từ tu luyện (2026-08-20) — EnemyReward
          // khong con field cultivation. Spirit stone di qua receiver
          // (MaterialBag); techniqueMastery KHONG di qua RewardSystem
          // (khong phai Reward field) va skillInsight co duong inline
          // rieng ben duoi - truyen CHI spiritStone de tranh moi field
          // collision qua receiver.
          this.giveReward(this.receiver, { spiritStone: rewards.spiritStone })

          // Cảm ngộ Kỹ năng — LUÔN cấp thẳng vào player, KHÔNG cần
          // so huu tam phap (khac techniqueMastery o tren, xem
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

          const activeStageId = this.deps.stageManager.getActive()?.stageId
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

          // Kiem Y vinh vien (spec 2026-08-29-kiem-the-kiem-y sec.3.1) -
          // counts boss kills: stage bosses (isBoss) + elite/mini-boss
          // (isElite); tribulation bosses are also isBoss entities via
          // the defineEnemy tribulation template. ONLY the Kiem Tu
          // route's Bat Kiem consumes stacks, but the counter accrues
          // for EVERY path (harmless over-counting, switching path late
          // loses no progress).
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
    const activeStageId = this.deps.stageManager.getActive()?.stageId
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

        // P7-M3 — learn-by-drop retired: DropKind has no 'technique'
        // member, canonical techniques come from the Way at initiation.
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
    return RANK_PARTICLE_COLORS[grade]
  }

  private getQualityParticleColor(quality: ItemQuality): number {
    return RANK_PARTICLE_COLORS[quality]
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
