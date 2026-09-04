import { SkillManager } from '../skill/SkillManager'
import type { Skill } from '../skill/Skill'
import { TechniqueManager } from '../technique/TechniqueManager'
import type { Technique } from '../technique/Technique'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import { EquipmentBag, type AutoDissolveReward } from '../equipment/EquipmentBag'
import { EquipmentSystem } from '../equipment/EquipmentSystem'
import { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import { AffixRegistry } from '../equipment/AffixRegistry'
import { BuildingManager } from '../building/BuildingManager'
import type { BuildingInstance } from '../building/BuildingInstance'
import { QuestManager } from '../quest/QuestManager'
import { ProductionSystem } from '../production/ProductionSystem'
import type { ProductionSiteState } from '../production/ProductionTypes'
import { AlchemySystem, type ActiveAlchemyJob } from '../alchemy/AlchemySystem'
import { getAlchemySuccessBonusPercentPoints } from '../talent/TalentEffects'
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import type { GameSave } from '../../services/save/SaveSystem'
import { NotificationQueue } from './NotificationQueue'
import { TemplateRegistry } from './TemplateRegistry'

export interface GameManagerSaveRestoreDeps {
  skillManager: SkillManager
  skillTemplates: TemplateRegistry<Skill>
  techniqueManager: TechniqueManager
  techniqueTemplates: TemplateRegistry<Technique>
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag
  equipmentRegistry: EquipmentRegistry
  equipmentBag: EquipmentBag
  equipmentSystem: EquipmentSystem
  equipmentSlotManager: EquipmentSlotManager
  affixRegistry: AffixRegistry
  buildingManager: BuildingManager
  questManager: QuestManager
  productionSystem: ProductionSystem
  alchemySystem: AlchemySystem
  notifications: NotificationQueue
  // GameManager giữ activePlayer như field mutable (setActivePlayer) — đọc
  // LIVE qua closure thay vì snapshot tại constructor time, giống
  // GameManagerBuildingOps/GameManagerQuestOps.
  getActivePlayer: () => PlayerData | undefined
  // Hai hook dưới thuộc BUILDING section (đã tách ở task 3) — restore chỉ
  // gọi lại chúng, không sở hữu logic, nên nhận qua closure.
  refreshAutoWorkerCapacity: (player: PlayerData, instance: BuildingInstance) => void
  getWorkerAssignments: () => Map<string, number>
  // Auto-farm Task 5 (2026-09-04) — offline catch-up closure (logic sống
  // trên GameManager, SaveRestore chỉ gọi lại — cùng pattern trên).
  settleAutoFarmOffline: (player: PlayerData, elapsedOfflineSeconds: number) => void
}

/**
 * Tách khỏi GameManager (2026-09-03, task 5 — GameManager split) — phần
 * RESTORE save VÀO instance đang chạy (nạp lại registry/bag/manager/system
 * + offline settle). KHÔNG phải phần serialize-ra-JSON: chỗ đó là
 * `services/save/SaveSystem.ts`, ngoài phạm vi module này.
 *
 * Cùng pattern DI với GameManagerQuestOps/BuildingOps/AlchemyOps:
 * constructor nhận dependency tường minh qua object `deps`, KHÔNG import
 * ngược GameManager.
 */
export class GameManagerSaveRestore {
  constructor(private readonly deps: GameManagerSaveRestoreDeps) {}

  /**
   * Validate registry-backed save references without mutating any restore owner.
   * App calls this before Pinia restore; restoreFromSave repeats it defensively.
   */
  preflightSaveRegistryReferences(save: GameSave): void {
    for (const instance of save.equipment) {
      if (!this.deps.equipmentRegistry.has(instance.itemId)) {
        throw new Error(`Unknown equipment template in save: ${instance.itemId}`)
      }

      for (const affix of instance.affixes) {
        if (!this.deps.affixRegistry.has(affix.affixId)) {
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
      if (!this.deps.techniqueManager.has(technique.id)) {
        // Text-refresh-on-load: cung logic voi skill ben duoi -- name/
        // description la du lieu hien thi thuan, luon dong bo tu template
        // dang dang ky thay vi giu nguyen ban da dong bang trong save cu.
        const template = this.deps.techniqueTemplates.get(technique.id)

        if (template) {
          technique.name = template.name
          technique.description = template.description
        }

        this.deps.techniqueManager.add(technique)
      }
    }

    for (const skill of save.skills) {
      if (this.deps.skillManager.has(skill.id)) {
        continue
      }

      // Execution policy rework + development-build no-migration (2026-
      // 08-26): save của nhân vật CŨ lưu skill object nguyên trạng trước
      // khi có field `execution` bắt buộc — scheduler thống nhất BỎ QUA
      // mọi active thiếu execution ("không cast gì" dù tele/di chuyển
      // vẫn chạy). Đối chiếu template đã đăng ký để hồi phục AUTHORED
      // combat data (execution/targeting/AOE/VFX preset), giữ NGUYÊN
      // progression state của instance (level/equipped/slot/cooldown/
      // specialization). Template thiếu thì giữ nguyên object save.
      const template = this.deps.skillTemplates.get(skill.id)

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

      this.deps.skillManager.add(skill)
    }

    for (const entry of save.materials) {
      if (this.deps.materialRegistry.has(entry.materialId)) {
        this.deps.materialBag.add(this.deps.materialRegistry.get(entry.materialId), entry.amount)
      }
    }

    for (const entry of save.pills) {
      if (this.deps.pillRegistry.has(entry.pillId)) {
        this.deps.pillBag.add(this.deps.pillRegistry.get(entry.pillId), entry.amount)
      }
    }

    // Phù/Trận legacy (plan §10.1): save đã qua migration v44 có mảng
    // rỗng — bỏ qua hoàn toàn, không còn bag để nạp.

    // Cap mềm (audit 2026-08-31) — restore save quá cap: tự Hóa Luyện
    // phần tràn, GOM rewards cả batch để cộng material + toast đúng 1
    // LẦN cuối vòng (auto-dissolve chạy ngay trong từng add() nhưng
    // người chơi không cần 500 toast). KHÔNG gọi quest hook tại đây —
    // notifyQuestMaterialGained() phải bỏ qua restore (double-count,
    // xem ghi chú tại hàm đó).
    let restoredAutoDissolved: AutoDissolveReward[] = []

    for (const instance of save.equipment) {
      restoredAutoDissolved = [
        ...restoredAutoDissolved,
        ...(this.deps.equipmentBag.add(instance) ?? []),
      ]
    }

    for (const reward of restoredAutoDissolved) {
      if (this.deps.materialRegistry.has(reward.materialId)) {
        this.deps.materialBag.add(this.deps.materialRegistry.get(reward.materialId), reward.amount)
      }
    }

    if (restoredAutoDissolved.length > 0) {
      this.deps.notifications.push({
        kind: 'loot',
        message: `Túi đầy — tự Hóa Luyện ${restoredAutoDissolved.length} món thành Tinh Hoa`,
      })
    }

    // MASTER SPEC Mục XVI (Phase 9) — slot state (enhance) PHẢI nạp
    // trước refreshModifiers() bên dưới.
    this.deps.equipmentSlotManager.restore(save.equipmentSlots)

    // ModifierSystem nội bộ của equipmentSystem không tự phục hồi
    // theo EquipmentBag vừa nạp — phải build lại thủ công.
    this.deps.equipmentSystem.refreshModifiers(
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )

    this.deps.buildingManager.restore(save.buildings)

    // Chi Hien Quan (chi-hien-quan spec) — re-apply worker capacity từ
    // instance CHQ trong save (autoWorkerCapacity trong save có thể stale
    // — công thức là source of truth, không tin field đã lưu).
    const chqPlayer = this.deps.getActivePlayer()

    if (chqPlayer) {
      const chiHienQuan = this.deps.buildingManager.getByBuildingId('chi_hien_quan')

      if (chiHienQuan) {
        this.deps.refreshAutoWorkerCapacity(chqPlayer, chiHienQuan)
      }
    }

    this.deps.questManager.restore(
      save.quests ?? { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    )

    // Production (plan §4.3) — restore state + offline settle tuần tự
    // trong cap; MỖI auto-cycle một seed/roll riêng.
    this.deps.productionSystem.restoreStates((save.productionSites ?? []) as ProductionSiteState[])

    for (const definition of this.deps.productionSystem.getSiteDefinitions()) {
      this.deps.productionSystem.ensureSiteState(definition.siteId)
    }

    const offlinePlayer = this.deps.getActivePlayer()

    if (offlinePlayer) {
      const elapsedOfflineSeconds = Math.max(
        0,
        (Date.now() - (save.player.lastSavedAt ?? Date.now())) / 1000,
      )

      if (elapsedOfflineSeconds > 60) {
        // T3 (economy-ecosystem-plan) — worker chạy offline như slot tay
        // trong cap: truyền capacity + mốc bắt đầu vắng mặt để settle
        // đúng cửa sổ.
        this.deps.productionSystem.settleOffline(
          this.deps.materialBag,
          this.deps.materialRegistry,
          offlinePlayer.realmId,
          Date.now(),
          {
            workerCapacity: offlinePlayer.autoWorkerCapacity ?? 0,
            offlineSinceMs: save.player.lastSavedAt ?? Date.now(),
            workerAssignments: this.deps.getWorkerAssignments(),
          },
        )

        // Auto-farm Task 5 (2026-09-04) — NGOẠI LỆ DUY NHẤT combat nhận
        // reward offline: roll các chu kỳ auto-farm đã trôi trong cửa sổ
        // offline (cùng gate >60s với Production catch-up).
        this.deps.settleAutoFarmOffline(offlinePlayer, elapsedOfflineSeconds)
      }
    }

    // Đan Phòng offline settle (§8.2).
    this.deps.alchemySystem.restoreJobs((save.alchemyJobs ?? []) as ActiveAlchemyJob[])

    this.deps.alchemySystem.settleOffline(
      this.deps.pillBag,
      (pillId) =>
        this.deps.pillRegistry.has(pillId) ? this.deps.pillRegistry.get(pillId) : undefined,
      Date.now(),
      getAlchemySuccessBonusPercentPoints(this.deps.getActivePlayer()?.selectedTalentIds ?? []),
    )

    return this.deps.equipmentSystem.getModifiers()
  }
}
