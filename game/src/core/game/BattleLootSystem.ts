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
import {
  applyArtifactExperience,
  getArtifactExperienceReward,
  isArtifactDomainUnlocked,
} from '../artifact/ArtifactProgression'
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
import { physiqueEssenceGradeOf } from '../../data/realm/PhysiqueEssence'
import {
  isBreakthroughAcquisitionEnabled,
  isCompanionPullTokenSourceSuppressed,
  isDomainScopedAcquisitionEnabled,
} from '../realm/ReleasePolicy'
import type { PlayerData } from '../player/Player'

/** Purple of the Tinh Hoa family stream (2026-08-30, M-QI-08) - flies back to the player. */
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
  // M-F-BODY-PERFECTION - material landings route through the ONE
  // funnel (collect-quest + canonical discovery) instead of calling
  // onMaterialCollected directly; quest deps stay for the kill hook.
  notifyMaterialGained: (materialId: string, amount: number) => void
  // Quai an (spec dot-pha-loi-kiep S4.1c) - dem kill Luyen Khi/reset
  // khi giet quai an.
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

  // Receiver de phat thuong khi battle hien tai ket thuc thang -
 // xem setSessionReceiver() v- processDefeatedEnemies().
  private receiver: RewardReceiver | null = null

  // PlayerData cua tran dang dien ra - can cho viec roll equipment
  // rot ra (chi so chinh scale theo canh gioi nguoi choi).
  private player: PlayerData | null = null

  // Kenh drop hien tai - 'active' mac dinh; auto-farm idle bat 'idle'
  // qua setChannel() roi khoi phuc sau moi cycle (Task 9 wiring).
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

    // M-F-TECHNIQUE - realm context enters at the settle seam: the
    // realm-scaled ceiling (min(18, realmLevel) in-band; 0 while
    // lagging) clamps accrual inside TechniqueSystem. No session
    // player -> 'mortal'/0 fails closed (nothing trains).
    const { gained } = this.deps.techniqueSystem.gainMastery(
      amount,
      this.player?.realmId ?? 'mortal',
      this.player?.realmLevel ?? 0,
    )
    this.summary.techniqueMastery += gained

    if (gained > 0 && sourceId) {
      this.emitRewardParticle(sourceId, 'insight', 0x78e6d0)
    }
  }

  // startBattleWithPlayer() goi sau beginBattle().
  setSession(receiver: RewardReceiver, player: PlayerData) {
    this.receiver = receiver
    this.player = player
  }

  getSummary(): BattleRewardSummary {
    return this.summary
  }

  /**
   * Nhieu quai co the chet cung luc/lien tuc (wave) -- quet TOAN BO
   * `enemies` moi tick, cap thuong cho con nao vua chet ma chua
   * xu ly (rewardGranted la co chong lap thuong), roi don khoi mang
   * in-place. Khong con gate theo battle.state === 'victory' nhu model
   * 1v1 cu -- quai chet giua chung luc battle van 'fighting' van phai
   * cap thuong ngay, khong doi ca tran ket thuc.
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

      // Thien phu Huyet Chien - diet quai hoi % max HP (plan S6). Dat
      // ngoai nhanh receiver de kill nao cung hoi, ke ca tran khong loot.
      // Di qua combatSystem.applyHealing() de phat 'entity_vitals_changed'
      // (HUD mau cap nhat), khong mutate thang currentHp nhu truoc.
      // healTarget = null is a deliberate opt-out (auto-farm idle).
      const healOnKillPercent = this.player
        ? getHealOnKillMaxHpPercent(this.player.selectedTalentIds, this.player.talentLevels)
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

          // Thien phu Tu Bao - nhan Linh Thach TRUOC khi giveReward de
          // luong that vao tui khop summary (plan S6).
          const talentStoneMultiplier = this.player
            ? getSpiritStoneGainMultiplier(this.player.selectedTalentIds, this.player.talentLevels)
            : 1
          // Scale thuong theo canh gioi stage (Truc Co x3, xem
          // RealmRewardScale) - Truc Co tai su dung enemyPool Luyen Khi
          // nen phai nhan thuong de thu nhap khong bi khung. Nhan ca
          // techniqueMastery (tac dung phu: artifact EXP + skill insight
          // tang theo o Truc Co, da duoc duyet 2026-08-28). Currency now
          // comes from the stage drop table (already multiplied by the
          // modifier currency coefficient inside resolveDrops) - the
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

          // Tu vi gio CHI den tu tu luyen (2026-08-20) - EnemyReward
          // khong con field cultivation. Spirit stone di qua receiver
          // (MaterialBag); techniqueMastery KHONG di qua RewardSystem
          // (khong phai Reward field) va skillInsight co duong inline
          // rieng ben duoi - truyen CHI spiritStone de tranh moi field
          // collision qua receiver.
          this.giveReward(this.receiver, { spiritStone: rewards.spiritStone })

          // Cam ngo Ky nang - LUON cap thang vao player, KHONG can
          // so huu tam phap (khac techniqueMastery o tren, xem
          // skill-insight-and-auto-combat-hud-plan.md muc 3).
          // Thien phu Dai Tri Nhuoc Ngu/Nghich Thien nhan tai day (plan S6).
          const baseSkillInsight = getSkillInsightReward(rewards)
          const skillInsightGained =
            baseSkillInsight > 0 && this.player
              ? Math.floor(baseSkillInsight * getInsightGainMultiplier(this.player.selectedTalentIds, this.player.talentLevels))
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

          // Quai an (spec dot-pha-loi-kiep S4.1c) - dem kill Luyen Khi;
          // giet Huyet Mong reset cua so ve 0. ACTIVE kills only - the
          // hidden-substitution window is ACTIVE-only, so idle auto-farm
          // cycles must not warm the counter it never benefits from.
          if (this.player && this.channel === 'active') {
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

    // Don quai da chet + da cap thuong khoi mang -- tranh phinh vo han
    // qua nhieu wave trong cung 1 stage. In-place splice: the same
    // postcondition the old `battle.enemies = filter(alive)` gave -- sau
    // buoc nay `enemies` chi con quai dang song, nen "con quai khong" =
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
   * Do roi thang vao bag tuong ung ngay khi quai chet - consume phan
   * `items` resolveDrops da quyet dinh (KHONG roll them gi o day; chi
   * 'equipment_any' con 1 lan rut template tu registry vi resolver
   * khong biet registry). Moi lan cong thanh cong day 1 toast 'loot'
   * vao NotificationQueue. Luong tran stack (tui day) duoc gom lai va
   * bao MOT toast duy nhat cuoi dot thay vi mat lang le.
   */
  private grantResolvedDrops(
    items: ResolvedDropItem[],
    qualityBonusSteps: number,
    sourceId: string,
  ) {
    const overflowParts: string[] = []

    // Dia Gioi ghep dong (2026-08-15) - Zone chua Stage dang hoat dong
    // luc rot do, xem ZoneRegistry.getZoneForStage()/EquipmentNaming.ts.
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
        // Fix 2 follow-up (final review, optional minor) - dung
        // --grade-${quality} thay vi tu tinh lai rank-color-N (dup logic
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

            // M-F-CEILING - breakthrough-scoped material stays dormant
            // while release policy closes the transition into its tagged
            // realm (post-resolve filter; rng order untouched).
            if (!isBreakthroughAcquisitionEnabled(material.breakthroughRealmId)) {
              break
            }

            // M-F-COMPANION-GIFT - censused pull-token drop lines stay
            // dormant while the pull pool is closed; sibling lines still
            // land (post-resolve filter; rng order untouched).
            if (isCompanionPullTokenSourceSuppressed(drop.itemId)) {
              break
            }

            // M-F-ARTIFACT-DEFER - domain-scoped material (doan_bao_thach
            // today) additionally composes the window+reach rule keyed to
            // the PLAYER's realm, so the retained authored row delivers
            // only once the player unlocks the domain.
            if (
              !isDomainScopedAcquisitionEnabled(material.domainUnlockRealmId, this.player?.realmId)
            ) {
              break
            }

            const amount = drop.amount

            const materialOverflow = this.deps.materialBag.add(material, amount)

            // Collect-quest + perfection-discovery hook - chi tinh
            // luong that su vao tui (tru overflow).
            this.deps.notifyMaterialGained(drop.itemId, amount - materialOverflow)

            if (materialOverflow > 0) {
              overflowParts.push(`${materialOverflow} ${material.name}`)
            }

            // Tinh Hoa family (2026-08-30, M-QI-08) - kind 'essence'
            // rieng: stream tim bay VE NGUOI CHOI (combat-essence-stream.ts),
            // mote cuoi cham player moi nap tien do Luyen The (App.vue
            // drain). Loot da vao bag o tren nen presentation bi bo qua
            // khong mat gi. Family membership comes from the canonical
            // PhysiqueEssence reverse lookup - presentation only, never
            // progression authority.
            if (physiqueEssenceGradeOf(drop.itemId) !== undefined) {
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

            // M-F-CEILING - breakthrough-scoped pill stays dormant while
            // release policy closes the transition into its tagged realm.
            if (!isBreakthroughAcquisitionEnabled(pill.breakthroughRealmId)) {
              break
            }

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

        // 'equipment_any' - resolver tra ve khong kem itemId; rut ngau
        // nhien 1 template tu registry (duong "roi do ngau nhien" cu).
        case 'equipment_any':
          grantEquipment(undefined)
          break

        // P7-M3 - learn-by-drop retired: DropKind has no 'technique'
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
   * EXP Ban Menh Phap Bao (doc S5.2) - cung nguon/nhip per-kill voi
   * skillInsight o tren (cong THANG vao player.artifact, KHONG qua
   * RewardReceiver/RewardSystem - day la ho diem rieng, khong can
   * trang bi/so huu gi khac de nhan, giong skillInsight).
   */
  private grantArtifactExperience(enemy: Enemy) {
    // M-F-CEILING (C2C-12): the artifact domain is hidden for a
    // beyond-ceiling save - EXP feed is domain ACCESS, so it stops here.
    // The persisted artifact itself is untouched (restore never strips
    // ownership; see normalizeArtifactProgress).
    if (!this.player?.artifact || !isArtifactDomainUnlocked(this.player.realmId)) {
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
   * Cap mem tui trang bi (audit 2026-08-31) - EquipmentBag.add() tu Hoa
   * Luyen item "rac" nhat khi vuot cap va TRA rewards Tinh Hoa cho
   * caller cong. Null-safe voi mock tests (add tra undefined khi bi
   * mock). Cong qua materialBag + quest hook nhu nhanh 'material',
   * toast 1 lan moi batch qua NotificationQueue san co.
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

      // 9.8 - tran tui: funnel chi tinh delivered + toast bag.overflow.
      const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(reward.materialId), reward.amount)

      this.deps.notifyMaterialGained(reward.materialId, reward.amount - overflow)

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

  // Gop theo itemId+kind (nhieu wave cung tran co the rot trung loai)
  // thay vi day 1 dong rieng moi lan rot - CombatVictoryPanel hien
  // "+N ten vat pham" gon, khong lap dong.
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
