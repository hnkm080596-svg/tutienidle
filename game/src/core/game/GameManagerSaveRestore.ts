import { SkillManager } from '../skill/SkillManager'
import type { Skill } from '../skill/Skill'
import type { TechniqueSystem } from '../technique/TechniqueSystem'
import type { Technique } from '../technique/Technique'
import {
  getTechniqueGradeCeiling,
  getTechniqueMasteryForNextRank,
  TECHNIQUE_RANK_CAP,
} from '../technique/TechniqueProgression'
import { getRealmIndex } from '../realm/realmSystem'
import {
  TECHNIQUE_COMPLETION_STATES,
  type TechniqueCompletionState,
} from '../technique/Technique'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { getActiveWayDefinition } from '../player/CultivationPathKit'
import { isMortalPrecursorSkillId } from '../skill/MortalPrecursors'
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
import { BuildingRegistry } from '../building/BuildingRegistry'
import { QuestManager } from '../quest/QuestManager'
import { ProductionSystem } from '../production/ProductionSystem'
import type { ProductionSiteState } from '../production/ProductionTypes'
import { resolveProductionWorkerCapacity } from '../production/WorkerCapacity'
import { DecomposeSystem, type DecomposeOutputEntry } from '../production/DecomposeSystem'
import { AlchemySystem, type ActiveAlchemyJob } from '../alchemy/AlchemySystem'
import { getAlchemyDoublePill } from '../talent/TalentEffects'
import type { PlayerData } from '../player/Player'
import {
  applyAllBodyModifiers,
  assertBodyProgressionIntegrity,
} from '../realm/body/BodyProgressionSystem'
import { assertBodyPerfectionIntegrity } from '../realm/body/BodyPerfection'
import type { StatModifier } from '../stats/StatCalculator'
import { computeRestoreIdentity, type GameSave } from '../../services/save/saveTypes'
import { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import { TemplateRegistry } from './TemplateRegistry'

export interface GameManagerSaveRestoreDeps {
  skillManager: SkillManager
  skillTemplates: TemplateRegistry<Skill>
  // P7-M6 - restore routes through the single writer so the
  // techniqueProgress mirror republishes from the canonical holder.
  techniqueSystem: TechniqueSystem
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
  buildingRegistry: BuildingRegistry
  buildingManager: BuildingManager
  questManager: QuestManager
  productionSystem: ProductionSystem
  alchemySystem: AlchemySystem
  notifications: NotificationQueue
  // GameManager giu activePlayer nhu field mutable (setActivePlayer) - doc
  // LIVE qua closure thay vi snapshot tai constructor time, giong
  // GameManagerBuildingOps/GameManagerQuestOps.
  getActivePlayer: () => PlayerData | undefined
  // Hai hook duoi thuoc BUILDING section (da tach o task 3) - restore chi
  // goi lai chung, khong so huu logic, nen nhan qua closure.
  refreshAutoWorkerCapacity: (player: PlayerData, instance: BuildingInstance) => void
  getWorkerAssignments: () => Map<string, number>
  // Auto-farm Task 5 (2026-09-04) - offline catch-up closure (logic song
  // tren GameManager, SaveRestore chi goi lai - cung pattern tren).
  settleAutoFarmOffline: (player: PlayerData, elapsedOfflineSeconds: number) => void
  // Mission B audit - the persisted farm lease must also RE-ACQUIRE the
  // StageManager slot at restore; settle alone leaves the slot free while
  // persisted state stays armed.
  reconcileAutoFarmRuntime: (player: PlayerData) => void
  // R7 (AR-08) - decompose restore + shared delivery closure (online
  // tick and offline settle use the SAME delivery/overflow path).
  decomposeSystem: DecomposeSystem
  deliverDecomposeOutput: (entry: DecomposeOutputEntry) => void
  // R8.1 (AR-09) - quest lifecycle reconciliation command (logic lives
  // on GameManager; restore triggers it at the right boundary).
  reconcileQuestLifecycle: () => void
}

/**
 * Tach khoi GameManager (2026-09-03, task 5 - GameManager split) - phan
 * RESTORE save VAO instance dang chay (nap lai registry/bag/manager/system
 * + offline settle). KHONG phai phan serialize-ra-JSON: cho do la
 * `services/save/SaveSystem.ts`, ngoai pham vi module nay.
 *
 * Cung pattern DI voi GameManagerQuestOps/BuildingOps/AlchemyOps:
 * constructor nhan dependency tuong minh qua object `deps`, KHONG import
 * nguoc GameManager.
 */
export class GameManagerSaveRestore {
  constructor(private readonly deps: GameManagerSaveRestoreDeps) {}

  // R10 (AR-12, S4) - once-only settle: the identical payload hash as the
  // last APPLIED restore (see computeRestoreIdentity) converges instead of
  // re-running the full restore + offline settlement a second time. Scoped
  // per GameManagerSaveRestore instance (one per GameManager/session),
  // mirroring the store-level guard in stores/player.ts - same concept,
  // separate tracker per restore owner.
  private lastAppliedPayloadHash: string | undefined

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

    // R10 (AR-12, S4) - materials/pills/buildings previously had no
    // preflight coverage at all: the restore loops silently dropped an
    // unknown ID via `if (registry.has(id)) ...` instead of rejecting.
    // Per the project's established registry-drift principle (learned-
    // defects QA-2026-09-01-013), silently filtering an owned current
    // entry is data loss, not recovery - hard-fail before any owner
    // mutation, same contract equipment already had. Skills/techniques
    // are intentionally NOT included here: an unknown template there
    // drops the entry at restore (see the restore loops below), not a
    // registry-drift rejection case.
    for (const entry of save.materials) {
      if (!this.deps.materialRegistry.has(entry.materialId)) {
        throw new Error(`Unknown material in save: ${entry.materialId}`)
      }
    }

    for (const entry of save.pills) {
      if (!this.deps.pillRegistry.has(entry.pillId)) {
        throw new Error(`Unknown pill in save: ${entry.pillId}`)
      }
    }

    for (const instance of save.buildings) {
      if (!this.deps.buildingRegistry.has(instance.buildingId)) {
        throw new Error(`Unknown building in save: ${instance.buildingId}`)
      }
    }

    // Mission A review (MA-R1-04) - an unknown siteId previously passed
    // preflight, then occupied worker allocation slots while producing
    // nothing (no definition -> cycleMs 0), permanently draining capacity
    // from real sites. Registry-backed reference -> hard-fail here.
    for (const site of save.productionSites ?? []) {
      if (!this.deps.productionSystem.getSiteDefinition(site.siteId)) {
        throw new Error(`Unknown production site in save: ${site.siteId}`)
      }
    }

    // P7-M3 (v70) - techniques DO get hard validation here (upgraded
    // from the old "unknown id drops silently" restore): the holder is
    // 0-or-1 and MUST equal the committed way's techniqueId; a way-less
    // (mortal) save must carry none. A mismatch is corrupt progression
    // state, not drift - reject before any owner mutation.
    const activeWay = getActiveWayDefinition(save.player)

    if (activeWay) {
      const entry = save.techniques[0]

      if (save.techniques.length !== 1 || entry?.id !== activeWay.techniqueId) {
        throw new Error(
          `Technique holder contract violated in save: way '${activeWay.id}' requires exactly '${activeWay.techniqueId}', found ${save.techniques.length} entries`,
        )
      }

      if (!this.deps.techniqueTemplates.has(entry.id)) {
        throw new Error(`Unknown technique in save: ${entry.id}`)
      }

      const ceiling = getTechniqueGradeCeiling(save.player.realmId)
      const cost = getTechniqueMasteryForNextRank(entry.grade)

      // M-F-TECHNIQUE (v75) - gradeHistory is REQUIRED canonical
      // state: every record is {finalRank int 0..18,
      // completionState 'partial'|'dai_thanh'|'vien_man'} and the
      // key set must be canonical: {1..grade-1} all sealed plus
      // {grade} iff the live grade lags the realm (sealed or
      // born-dead skipped). An in-band trainable live grade never
      // carries a record.
      const history = entry.gradeHistory
      const records =
        typeof history === 'object' && history !== null && !Array.isArray(history)
          ? (history as Record<string, unknown>)
          : undefined
      const recordShapeOk =
        records !== undefined &&
        Object.entries(records).every(([key, record]) => {
          const g = Number(key)
          // Canonical decimal spelling: Number() coerces "01"/"1.0"/
          // "1e0" to a valid grade, but the writer only ever emits
          // canonical digits - an alias spelling is a stray record.
          if (!Number.isInteger(g) || g < 1 || g > entry.grade || String(g) !== key) {
            return false
          }
          const r = record as Record<string, unknown> | null
          return (
            typeof r === 'object' &&
            r !== null &&
            Number.isInteger(r.finalRank) &&
            (r.finalRank as number) >= 0 &&
            (r.finalRank as number) <= TECHNIQUE_RANK_CAP &&
            TECHNIQUE_COMPLETION_STATES.includes(
              r.completionState as TechniqueCompletionState,
            )
          )
        })

      const realmIndex = getRealmIndex(save.player.realmId)
      const laggingLiveGrade = entry.grade < realmIndex
      const keySetOk =
        recordShapeOk &&
        // Short-circuit bounds the enumeration before Array(): a
        // non-integer/huge grade must reject via the chain below, not
        // RangeError or allocate.
        Number.isInteger(entry.grade) &&
        entry.grade >= 1 &&
        entry.grade <= ceiling &&
        [...Array(entry.grade - 1).keys()].every((g) =>
          Object.prototype.hasOwnProperty.call(records, g + 1),
        ) &&
        Object.prototype.hasOwnProperty.call(records, entry.grade) === laggingLiveGrade

      if (
        !Number.isInteger(entry.grade) ||
        entry.grade < 1 ||
        entry.grade > ceiling ||
        !Number.isInteger(entry.rank) ||
        entry.rank < 0 ||
        entry.rank > TECHNIQUE_RANK_CAP ||
        !Number.isInteger(entry.mastery) ||
        entry.mastery < 0 ||
        (entry.rank < TECHNIQUE_RANK_CAP && entry.mastery >= cost) ||
        (entry.rank >= TECHNIQUE_RANK_CAP && entry.mastery !== 0) ||
        !ITEM_QUALITY_ORDER.includes(entry.quality) ||
        !recordShapeOk ||
        !keySetOk
      ) {
        throw new Error(`Invalid technique progression state in save: ${entry.id}`)
      }
    } else if (save.techniques.length !== 0) {
      throw new Error('Technique holder contract violated in save: way-less player carries a technique')
    }

    // P7-M4 (v71) - mortalBasicSkillId is the MORTAL-ONLY basic pick:
    // absent = the runtime's tram default; present = a precursor id the
    // player could have learned. Post-path presence is corrupt (the
    // ritual clears the pick inside the commit block - a way player can
    // never carry one) - reject before any owner mutation, same
    // hard-fail seam as the technique-holder contract above.
    const mortalPick = save.player.mortalBasicSkillId

    if (mortalPick !== undefined) {
      if (!isMortalPrecursorSkillId(mortalPick)) {
        throw new Error(`Invalid mortalBasicSkillId in save: ${String(mortalPick)}`)
      }

      if (save.player.cultivationPath !== undefined) {
        throw new Error(
          `mortalBasicSkillId persisted post-path in save: '${mortalPick}' on path '${save.player.cultivationPath}'`,
        )
      }
    }

    // P7-M5 (v72) - body progression integrity is the LAST preflight
    // check, delegated to the BodyProgression authority in one call
    // (shape already passed): completedTiers integral + 0..6, progress
    // under the active-tier cap / zero at 6, openedIds a strict prefix
    // of canonical MERIDIANS order. A corrupt slice is corrupt
    // progression state - reject before any owner mutation, same
    // hard-fail seam as the technique-holder contract above.
    assertBodyProgressionIntegrity(save.player)

    // M-F-BODY-PERFECTION (v77) - the perfection slice's semantic
    // integrity runs as the LAST preflight check too: authored-family
    // membership, perfected-realm keys, subset + realm-cap rules (see
    // core/realm/body/BodyPerfection). Same hard-fail seam - reject
    // before any owner mutation.
    assertBodyPerfectionIntegrity(save.player)
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

    // R10 (AR-12, S4) - converge on a repeated identical payload (boot
    // retry, reload race): skip re-applying and re-settling entirely,
    // return the already-current modifiers. A genuinely different payload
    // (even sharing lastSavedAt|cultivation) always runs the full restore.
    const payloadIdentity = computeRestoreIdentity(save)

    if (payloadIdentity === this.lastAppliedPayloadHash) {
      return this.deps.equipmentSystem.getModifiers()
    }

    // M1 (ARCH-001) - restore is REPLACEMENT for every slice: each owner
    // below receives a detached copy of the payload and resets its live
    // set to exactly what the save declares (absent/empty = defaults).
    // The identity hash commits at the END of this method - a mid-restore
    // throw must leave the payload uncommitted so a retry re-applies the
    // un-applied slices instead of being skipped by the guard above.

    // Techniques/skills - full replace of the learned sets. The text/
    // backfill refresh below runs on CLONES: the input save is a value
    // and must never be mutated by restore.
    const restoredTechniques = save.techniques.flatMap((savedTechnique) => {
      const technique = structuredClone(savedTechnique)

      // Text-refresh-on-load: cung logic voi skill ben duoi -- name/
      // description la du lieu hien thi thuan, luon dong bo tu template
      // dang dang ky thay vi giu nguyen ban da dong bang trong save cu.
      const template = this.deps.techniqueTemplates.get(technique.id)

      // Dev-stage rule: an entry with no registered template is dropped,
      // never kept with translated legacy fields.
      if (!template) {
        return []
      }

      technique.name = template.name
      technique.description = template.description
      technique.icon = template.icon
      technique.element = template.element
      technique.resourceLabel = template.resourceLabel
      technique.combatTypeId = template.combatTypeId

      // gradeEffects/combatModifiers are authored data and the template
      // is their authority, same contract as name/description above.
      // Re-deriving keeps a save frozen with stale/pre-rename authored
      // data from silently staying inert. Persisted grade/rank/mastery/
      // quality are progression state - the template's defaults do NOT
      // overwrite them.
      technique.gradeEffects = structuredClone(template.gradeEffects)
      technique.combatModifiers = structuredClone(template.combatModifiers)

      return [technique]
    })

    this.deps.techniqueSystem.restore(restoredTechniques)

    const restoredSkills = save.skills.flatMap((savedSkill) => {
      const skill = structuredClone(savedSkill)

      // Execution policy rework + development-build no-migration (2026-
      // 08-26): save cua nhan vat CU luu skill object nguyen trang truoc
      // khi co field `execution` bat buoc - scheduler thong nhat BO QUA
      // moi active thieu execution ("khong cast gi" du tele/di chuyen
      // van chay). Doi chieu template da dang ky de hoi phuc AUTHORED
      // combat data (execution/targeting/AOE/VFX preset), giu NGUYEN
      // progression state cua instance (level/cooldown/specialization).
      // Template thieu thi entry bi drop (dev-stage
      // rule: khong migrate, khong giu object mo coi).
      const template = this.deps.skillTemplates.get(skill.id)

      if (!template) {
        return []
      }

      if (!skill.execution && template.execution) {
        skill.execution = structuredClone(template.execution)
      }

      if (!skill.targeting && template.targeting) {
        skill.targeting = structuredClone(template.targeting)
      }

      // Text-refresh-on-load: name/description la du lieu HIEN THI THUAN
      // (khong phai progression), nen luon dong bo lai tu template dang
      // dang ky thay vi giu nguyen ban da dong bang trong save cu. Vi du
      // that da gap: 1 save cu tung luu "Huy Kiem" luc description bi
      // hong encoding (mojibake) -- sua Skills.ts khong tu hoi phuc cac
      // save da luu truoc do neu thieu buoc nay.
      skill.name = template.name
      skill.description = template.description

      // passiveModifiers/specializations are authored data owned by the
      // template; re-derive so stale authored fields frozen in the save
      // don't stay inert. selectedSpecializationId lives on the instance
      // (progression) and is untouched.
      skill.passiveModifiers = structuredClone(template.passiveModifiers)
      skill.specializations = structuredClone(template.specializations)

      // M-QI-05 - level is frozen authored data too: the canonical live
      // level is nodeLevels[core_<id>], so a save's stored `level` must
      // never survive as a second authority.
      skill.level = template.level

      // effects/triggers are the same authored-combat-data class:
      // nothing mutates them on the instance (progression lives in
      // level/selectedSpecializationId; specialization overrides ride
      // on `specializations` above). A save frozen with a stale shell
      // (e.g. da_phap_lien_tuyen's empty effects[] pre-fix) must
      // re-derive, not stay broken through every future battle.
      skill.effects = structuredClone(template.effects)
      skill.triggers = structuredClone(template.triggers)

      return [skill]
    })

    this.deps.skillManager.restore(restoredSkills)

    // R10 (AR-12, S3) - restore is REPLACEMENT, not additive: clear the
    // live bags before applying the save's materials/pills/equipment,
    // matching buildings/production sites/quests/decompose (already
    // replace, see R7/R8.1). Without this, a live-session restore into a
    // nonempty bag (boot retry, reload race) would merge saved entries on
    // top of whatever was already there instead of replacing it.
    this.deps.materialBag.clear()
    this.deps.pillBag.clear()
    this.deps.equipmentBag.clear()

    // M1 (ARCH-001, hook for M2/ARCH-011) - pending paid-op tickets
    // (equipment wash/refine) were bound to pre-restore item objects and
    // must die WITH the old set: a ticket's instanceId string can silently
    // re-resolve to a restored object, so the invalidation runs adjacent
    // to clear() - no window exists where a stale ticket observes a
    // replaced (or half-replaced) bag.
    this.deps.equipmentSystem.invalidatePendingOperationTickets()

    // 9.8 - add() tran stack tra luong bi mat; gom MOI LOAI material
    // mot event duy nhat (ca 2 loop materials + auto-dissolve rewards).
    const restoreOverflows = new Map<string, number>()

    for (const entry of save.materials) {
      if (this.deps.materialRegistry.has(entry.materialId)) {
        const overflow = this.deps.materialBag.add(
          this.deps.materialRegistry.get(entry.materialId),
          entry.amount,
        )

        if (overflow > 0) {
          restoreOverflows.set(entry.materialId, (restoreOverflows.get(entry.materialId) ?? 0) + overflow)
        }
      }
    }

    for (const entry of save.pills) {
      if (this.deps.pillRegistry.has(entry.pillId)) {
        this.deps.pillBag.add(this.deps.pillRegistry.get(entry.pillId), entry.amount)
      }
    }

    // Phu/Tran legacy (plan S10.1): save da qua migration v44 co mang
    // rong - bo qua hoan toan, khong con bag de nap.

    // Cap mem (audit 2026-08-31) - restore save qua cap: tu Hoa Luyen
    // phan tran, GOM rewards ca batch de cong material + toast dung 1
    // LAN cuoi vong (auto-dissolve chay ngay trong tung add() nhung
    // nguoi choi khong can 500 toast). KHONG goi quest hook tai day -
    // notifyMaterialGained() phai bo qua restore (double-count,
    // xem ghi chu tai ham do).
    let restoredAutoDissolved: AutoDissolveReward[] = []

    for (const savedInstance of save.equipment) {
      // Detached copy - the bag owns live objects; the payload stays a
      // value the caller may reuse/mutate without reaching live state.
      restoredAutoDissolved = [
        ...restoredAutoDissolved,
        ...(this.deps.equipmentBag.add(structuredClone(savedInstance)) ?? []),
      ]
    }

    for (const reward of restoredAutoDissolved) {
      if (this.deps.materialRegistry.has(reward.materialId)) {
        const overflow = this.deps.materialBag.add(
          this.deps.materialRegistry.get(reward.materialId),
          reward.amount,
        )

        if (overflow > 0) {
          restoreOverflows.set(reward.materialId, (restoreOverflows.get(reward.materialId) ?? 0) + overflow)
        }
      }
    }

    for (const [materialId, lostAmount] of restoreOverflows) {
      const template = this.deps.materialRegistry.get(materialId)

      this.deps.notifications.push(createBagOverflowEvent(template.name, lostAmount))
    }

    if (restoredAutoDissolved.length > 0) {
      this.deps.notifications.push({
        kind: 'loot',
        message: `Túi đầy — tự Hóa Luyện ${restoredAutoDissolved.length} món thành Tinh Hoa`,
      })
    }

    // MASTER SPEC Muc XVI (Phase 9) - slot state (enhance) PHAI nap
    // truoc refreshModifiers() ben duoi.
    this.deps.equipmentSlotManager.restore(save.equipmentSlots)

    // ModifierSystem noi bo cua equipmentSystem khong tu phuc hoi
    // theo EquipmentBag vua nap - phai build lai thu cong.
    this.deps.equipmentSystem.refreshModifiers(
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )

    this.deps.buildingManager.restore(save.buildings)

    // Chi Hien Quan (chi-hien-quan spec) - re-apply worker capacity tu
    // instance CHQ trong save (autoWorkerCapacity trong save co the stale
    // - cong thuc la source of truth, khong tin field da luu).
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

    // Production (plan S4.3) - restore state + offline settle tuan tu
    // trong cap; MOI auto-cycle mot seed/roll rieng.
    this.deps.productionSystem.restoreStates((save.productionSites ?? []) as ProductionSiteState[])

    for (const definition of this.deps.productionSystem.getSiteDefinitions()) {
      this.deps.productionSystem.ensureSiteState(definition.siteId)
    }

    const offlinePlayer = this.deps.getActivePlayer()

    // R7 (AR-08) - decompose: re-supply live capacity FIRST (CHQ
    // formula beats any stale saved value), THEN restore processing
    // state so saved workers clamp against the real ceiling, settle
    // the offline window under the shared cap concept, and deliver
    // output through the SAME delivery/overflow path as the tick.
    this.deps.decomposeSystem.updateCapacity(offlinePlayer?.autoWorkerCapacity ?? 0)
    this.deps.decomposeSystem.restore(save.decompose)

    if (offlinePlayer) {
      const elapsedOfflineSeconds = Math.max(
        0,
        (Date.now() - (save.player.lastSavedAt ?? Date.now())) / 1000,
      )

      if (elapsedOfflineSeconds > 60) {
        // T3 (economy-ecosystem-plan) - worker chay offline nhu slot tay
        // trong cap: truyen capacity + moc bat dau vang mat de settle
        // dung cua so.
        this.deps.productionSystem.settleOffline(
          this.deps.materialBag,
          this.deps.materialRegistry,
          offlinePlayer.realmId,
          Date.now(),
          {
            workerCapacity: resolveProductionWorkerCapacity(
              offlinePlayer.autoWorkerCapacity ?? 0,
              this.deps.decomposeSystem.getSettings().workers,
            ),
            offlineSinceMs: save.player.lastSavedAt ?? Date.now(),
            workerAssignments: this.deps.getWorkerAssignments(),
          },
        )

        this.deps.decomposeSystem.settleOffline(
          Date.now(),
          save.player.lastSavedAt ?? Date.now(),
        )

        for (const entry of this.deps.decomposeSystem.drainOutput()) {
          this.deps.deliverDecomposeOutput(entry)
        }

        // Auto-farm Task 5 (2026-09-04) - NGOAI LE DUY NHAT combat nhan
        // reward offline: roll cac chu ky auto-farm da troi trong cua so
        // offline (cung gate >60s voi Production catch-up).
        this.deps.settleAutoFarmOffline(offlinePlayer, elapsedOfflineSeconds)
      }

      // Mission B audit - re-acquire the StageManager lease for a persisted
      // farm on EVERY restore, not only inside the >60s settle window: a
      // fast reload restores an armed farm too. Without this the slot reads
      // free while tickAutoFarm keeps paying on persisted state alone, and
      // a manual stage start runs concurrent with the farm over the shared
      // BattleLootSystem session.
      this.deps.reconcileAutoFarmRuntime(offlinePlayer)
    }

    // Dan Phong offline settle (S8.2).
    this.deps.alchemySystem.restoreJobs((save.alchemyJobs ?? []) as ActiveAlchemyJob[])

    this.deps.alchemySystem.settleOffline(
      this.deps.pillBag,
      (pillId) =>
        this.deps.pillRegistry.has(pillId) ? this.deps.pillRegistry.get(pillId) : undefined,
      Date.now(),
      0,
      // M3 - Hoa Hau Thong Than: x2 pill yield applies to offline settle too.
      getAlchemyDoublePill(this.deps.getActivePlayer()?.selectedTalentIds, this.deps.getActivePlayer()?.talentLevels)?.yieldMultiplier ?? 1,
    )

    // P7-M5 (v72) - body modifier rehydration: chapter state is the
    // authority, persisted player.modifiers body slices are NOT trusted.
    // Rebuild the bat-mach: slice exactly once from the restored
    // canonical state (corrects stale/missing entries); M-F (D1) - the
    // retired luyen-the: slice is scrubbed, body gains live in the
    // assembled base instead. Runs BEFORE the hash commit so a rehydrate
    // throw leaves the payload uncommitted.
    const bodyPlayer = this.deps.getActivePlayer()

    if (bodyPlayer) {
      applyAllBodyModifiers(bodyPlayer)
    }

    // R8.1 (AR-09) - activation is a lifecycle command, not a UI read:
    // restore converges the active set to current eligibility BEFORE
    // the first tick runs. Placed LAST so the restored player realm is
    // final when unlock evaluation runs.
    this.deps.reconcileQuestLifecycle()

    // M1 (ARCH-001) - commit the payload identity only AFTER every slice
    // applied successfully: a mid-restore throw keeps the payload
    // uncommitted, so a retry of the same payload is not skipped.
    this.lastAppliedPayloadHash = payloadIdentity

    return this.deps.equipmentSystem.getModifiers()
  }
}

