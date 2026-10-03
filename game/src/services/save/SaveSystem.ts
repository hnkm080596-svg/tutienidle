import type { PlayerData } from '../../core/player/Player'
import type { GameManager } from '../../core/game/GameManager'
import type {
  AlchemyJobSave,
  GameSave,
  GameSessionPlayerOwner,
  ProductionCycleSave,
  ProductionSiteStateSave,
  RestoreGameSessionResult,
  RestoreTimeAuthority,
} from './saveTypes'
import { validateGameSaveShape } from './saveShapeValidation'
import { exportFilename, type ExportProvenance } from './recoveryApi'
import {
  isSaveAcceptable,
  staticSaveAcceptanceCatalogs,
} from './saveAcceptance'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import {
  listSaveEnvelopeKeys,
  resolveBackupKey,
  resolveImportHandoffKey,
  resolveRevisionKey,
  resolveSaveKey,
} from './saveKeys'

// large-file-split - save-shape interfaces (GameSave, stack saves,
// production/alchemy save states, restore contract) live in
// saveTypes.ts; re-exported so existing `from './SaveSystem'` imports
// keep working unchanged.
export * from './saveTypes'

// Re-export cho moi consumer cu (SupabaseCharacterCreationService, tests...)
// - nguon su that cua version nam o saveVersion.ts de tranh circular
// import voi saveShapeValidation.ts.
export { CURRENT_SAVE_VERSION }

// Storage keys are per-account since Mission F (spec F8) - every path
// below resolves through saveKeys.ts resolvers ('<base>:<accountId>',
// guest slot when unauthenticated). The comments below keep documenting
// the backup/handoff/revision *purpose*; the key shape lives there.

// Phase 5 (Reliability) - ban sao save TRUOC lan ghi de/xoa gan nhat
// (deleteSave()), khong phai lich su nhieu ban. Muc dich duy nhat:
// neu nguoi choi bam "Xoa & Bat Dau Moi" nham tren save khong tuong
// thich, du lieu cu van con 1 buoc de cuu qua restoreBackup() -
// KHONG thay the Export (export moi la noi an toan that su, backup
// nay nam cung localStorage nen mat theo neu nguoi dung xoa site data).

// Import current-version co equipment legacy phai normalize TRUOC khi ghi,
// nen reload sau import khong the tu dem lai entry da bo. Handoff one-shot
// nay giu counter cung CHINH XAC normalized payload de khong gan nham cho
// mot save khac duoc ghi xen giua; no khong nam trong GameSave schema.

// Revision phuc vu CAS optimistic-concurrency cua cloud-save adapter
// (xem services/cloudSave/). Dat o day (thay vi trong LocalCloudSaveService)
// de deleteSave() co the xoa cung luc, tranh de lai revision cu sau khi
// save chinh da bi xoa - neu khong, nhan vat moi tao se CAS-fail ngay
// lan save dau tien ("Save da thay doi o mot phien khac.").

// v23: Thien Cong Phuong rework - them building 'artisan_workshop',
// xoa han exploration 'myriad-demon-forest' (Van Yeu Lam), them
// 'wood-spirit-forest' (Moc Lam). Save cu (version < 23) KHONG tuong
// thich, khong viet migration - save cu co the dang chay do
// exploration 'myriad-demon-forest' (nap thang se ORPHAN entry do
// trong ExplorationManager: khong throw, nhung chiem vinh vien 1 slot
// concurrent ma khong cach nao thu hoach/huy vi id khong con trong
// registry).
// version 24: Phap Tu Redesign (magicpath) - player: PlayerData them 3
// field BAT BUOC MOI `skillPoints: number`/`unlockedElements: ElementType[]`/
// `equippedElements: ElementType[]` (ca hai da retired cung
// ElementLoadout o Phap Tu Reimagined Task 14 - element authority gio
// la `player.spellPath.element`), CONG THEM baseStats (Stats) luc do co
// them 6 field wind/lightning (da bi XOA lai o spec
// 2026-08-30-phap-tu-dao-sac sec5 - bo Phong/Loi toan he). Lich su
// version giu nguyen de truy vet.
// Save cu thieu cac field nay - khong viet migration, cung convention
// moi version truoc.
// version 25: Phap Tu Redesign - Node Tree, player: PlayerData them
// field BAT BUOC MOI `purchasedNodeIds: string[]` (xem
// core/progression/NodeSystem.ts). CONG THEM baseStats (Stats) them
// `manaShieldPercent` (Mana Shield). Save cu thieu cac field nay -
// khong viet migration, cung convention moi version truoc.
// version 26: Phap Tu Redesign - Tam Phap khong con cong chi so duoi
// bat ky hinh thuc nao (xoa `modifiers`/`mechanic`/`breakthroughEffect`
// khoi Technique.ts) VA `cultivationRate` bi xoa HOAN TOAN khoi Stats
// (baseStats mat field nay, toc do tu luyen gio co dinh - xem
// core/realm/realmSystem.ts's BASE_CULTIVATION_PER_SECOND). Save cu co
// `technique.modifiers`/`mechanic`/`breakthroughEffect` VA
// `baseStats.cultivationRate` KHONG khop shape moi - khong viet
// migration, cung convention moi version truoc.
// version 27: Phap Tu Redesign - gop 5 CultivationPathId Ngu Hanh
// (phap_tu_hoa/moc/thuy/kim/tho) thanh 1 "spell" duy nhat (xem
// CultivationPathKit.ts) VA player: PlayerData xoa field
// `totalMonstersKilled` (mo coi, xem RewardSystem.ts). Save cu co
// `player.cultivationPath` la 1 trong 5 gia tri cu (KHONG con hop le
// trong union moi) - khong viet migration, cung convention moi version
// truoc.
// version 28 (2026-08-20): Character/Cultivation/Skill/Inventory rework
// - player: PlayerData them field BAT BUOC MOI `techniqueExperience:
// number` (thanh kinh nghiem rieng cua Tam Phap, xem
// core/technique/TechniqueTier.ts). Save cu thieu field nay - khong
// viet migration, cung convention moi version truoc.
// version 29 (2026-08-20): Realm Passive & Pressure System - player:
// PlayerData them 4 field BAT BUOC MOI `bodyRefinementCompletedTiers`/
// `bodyRefinementCurrentTierProgress`/`breakthroughGrade`/
// `grantedRealmPassiveIds` (Luyen The Pham Nhan + Nhap Dao/Kien Co, xem
// core/realm/BodyRefinementSystem.ts/RealmPassiveSystem.ts). Save cu thieu
// cac field nay - khong viet migration, cung convention moi version
// truoc.
// version 30 (2026-08-21): Hoa FirePath redesign (Plans/FirePath) -
// baseStats (Stats) them field BAT BUOC MOI `projectileSpeedPercent`
// (Tat Hoa minor; MissileSystem sau do da xoa, xem ActionImpactSystem).
// Save cu thieu field nay - khong viet migration, cung convention moi
// version truoc.
// version 31 (2026-08-21): Hoa Truc Co hoan thien (Plans/FirePath muc
// 5-9) - baseStats (Stats) them 4 field BAT BUOC MOI
// `elementApplicationPercent`/`reactionEffectPercent`/
// `hoaTheGainPerCast`/`hoaTheDecayReductionPercent` (Dan Hoa/Hoa
// Nguyen/Cong Minh/Tu Hoa/Hoa Mach/Tu Viem, xem data/progression/
// PhapTuNodes.ts). Save cu thieu cac field nay - khong viet migration,
// cung convention moi version truoc.
// version 32 (2026-08-21): Thuy waterpath hoan thien (Plans/waterpath)
// - baseStats (Stats) them 2 field BAT BUOC MOI `thuyThePercent`/
// `waterReactionExtensionSeconds` (Tu Thuy/Thuy Mach/Nhu Luu/Dan Luu,
// xem data/progression/PhapTuNodes.ts). Save cu thieu cac field nay -
// khong viet migration, cung convention moi version truoc.
// version 33 (2026-08-21): Moc PoisonPath hoan thien (Plans/PoisonPath)
// - baseStats (Stats) them 4 field BAT BUOC MOI `ailmentDurationPercent`/
// `poisonRootPercentPerStack`/`poisonRootMaxStacks`/
// `poisonRootThresholdBonusPercent` (Doc Tuc/Doc Truong/Doc Can/Doc
// Uyen/Doc Mach, xem data/progression/PhapTuNodes.ts). Save cu thieu
// cac field nay - khong viet migration, cung convention moi version
// truoc.
// version 34 (2026-08-21): Tho EarthPath hoan thien (Plans/EarthPath) -
// baseStats (Stats) them 5 field BAT BUOC MOI `earthAoeRadius`/
// `earthAoeSecondaryDamagePercent`/`earthKnockbackDistance`/
// `skillImpactPercent`/`thoTheGainPerCast` (Tho The/Chan Luc/Chan Vuc/
// Trong Tho, xem data/progression/PhapTuNodes.ts). Save cu thieu cac
// field nay - khong viet migration, cung convention moi version truoc.
// version 35 (2026-08-21): Kim KimPath hoan thien (Plans/KimPath) -
// baseStats (Stats) them 5 field BAT BUOC MOI `kimTheGainPerProc`/
// `kimTheDotDamagePercentPerStack`/
// `kimTheDotResistancePenetrationPercentPerStack`/`kimTheMaxStacksBonus`/
// `metalAilmentPotencyPercent` (Kim The/Kim Uyen/Huyet An/Huyet Luu,
// xem data/progression/PhapTuNodes.ts). Day cung la hanh CUOI CUNG
// trong Ngu Hanh hoan tat redesign (Hoa/Thuy/Moc/Tho/Kim). Save cu
// thieu cac field nay - khong viet migration, cung convention moi
// version truoc.
// version 36 (2026-08-21): Plans/magicpathgeneral - Reaction Engine
// transaction refactor + DOT RES + Poison Recovery. baseStats (Stats)
// them 2 field BAT BUOC MOI `dotResistancePercent`/
// `poisonRecoveryPercent` (xem core/combat/CombatSystem.ts's
// applyDotDamage(), core/stats/StatTypes.ts). CUNG doi ten hien
// (2026-09-14 note: poisonRecoveryPercent has since retired - saves
// carrying it drop the key via the baseStats whitelist at restore.)
// thi "Doc Can" <-> "Moc The" cho dung semantic (KHONG doi field/id
// nao - save cu tuong thich voi rieng phan nay). Save cu thieu 2 field
// Stats moi - khong viet migration, cung convention moi version truoc.
// version 37 (2026-08-21): Plans/magicpathgeneral Phase 13 - Huyet
// Pha (Kim Tu). baseStats (Stats) them 2 field BAT BUOC MOI
// `huyetPhaGainPerProc`/`huyetPhaBurstDamage` (node "Huyet Pha", xem
// data/progression/PhapTuNodes.ts). `CombatEntity.currentHuyetPha` la
// optional/runtime-only, KHONG persist (khong can bump vi ly do nay).
// Save cu thieu 2 field Stats moi - khong viet migration, cung
// convention moi version truoc.
// version 38: progression/combat rework. No migration: development saves
// from earlier schemas are intentionally rejected.
// version 40 (skill-insight-and-auto-combat-hud-plan.md): PlayerData's
// `skillPoints` XOA HAN, thay bang `skillInsight`/`totalSkillInsightGained`
// (nhan tu chien dau, khong con cap khi dot pha tieu canh gioi, xem
// CultivationSystem.breakthrough()). ProgressionNode.cost doi ten thanh
// insightCost. Skill.experience/experienceRequired (XP-per-cast) da xoa
// entirely - skill upgrades now spend skillInsight via Core Node level (M-QI-05).
// Save cu thieu/lech field - khong viet migration, cung convention moi
// version truoc.
// version 41 (Milestone naming pass 2026-08-24, xem
// docs/naming-conventions.md) - doi TOAN BO id values/fields luu trong
// save theo quy uoc naming moi: realm 'pham_nhan'->'mortal',
// 'foundation'->'foundation_establishment'; grade 5 pham
// 'hoang_pham'->'hoang'... + field 'pham'->'grade' (Pill/Talisman/Formation);
// skills/techniques/materials/buildings theo bang mapping N2b; fields
// Luyen The 'luyenThe*'->'bodyRefinement*'. Save v40 KHONG tuong thich -
// khong viet migration, cung convention moi version truoc.
// Export cho cac service ngoai (vi du SupabaseCharacterCreationService
// gui p_schema_version khi tao nhan vat) - dam bao moi noi cung tham chieu
// MOT nguon chan ly ve version schema, khong tu hardcode so.
// version 42 (Combat Grid Rework 2026-08-24) - xoa stat
// projectileSpeedPercent khoi baseStats (StatBlock) cung he affix/node/
// enemy-input lien quan; thay the theo ngu canh: node phap thuat ->
// castSpeedPercent, affix vat ly -> attackSpeed/cooldown. Save v41
// KHONG tuong thich - khong migration, cung convention.
// version 43 (2026-08-24, resource-professions-rework): MIGRATION DAU
// TIEN duoc viet (pha convention "khong migration" - plan sec9 yeu cau
// migrate khong mat progression):
// - player.persistentTimedEffects: mac dinh [] (timed effect regen).
// - materials map id cu -> moi: linh_thao_chung->mortal_herb_common_raw,
//   quang_sat->mortal_ore_common_raw, thanh_linh_moc->mortal_wood_common_raw,
//   huyen_thiet->mortal_ore_common_processed, phu_chi->mortal_wood_common_processed
//   (gop amount neu trung id dich).
// - legacy pills map to the nearest effect: healing->pill_regen_mortal,
//   cultivation->pill_cultivation_mortal; permanent/buff do NOT become
//   +1 Main Stat (wrong semantics - plan sec.9) but refund 100 Linh
//   Thach/stack into player.spiritStone.
// Migration IDEMPOTENT: running twice does not double the refund.
// version 44 (2026-08-25, resource-professions-rework plan sec10 - rework
// vong kinh te "Dia Gioi -> Lam/Quang/Dong Thien -> Bag"):
// - materials: map cap raw/processed cu ve material TRUC TIEP moi theo
//   bang quy doi co dinh (khong parse ten ID ngoai pattern da chot):
//   wood_*_raw/processed -> `<realm>_wood_decade`; ore_*_raw/processed ->
//   `<realm>_ore_decade` (gp123 6E C2: truc tuoi thong nhat); herb_*_raw/processed -> thao Dong Thien decade
//   dau tien cua realm tuong ung (khong xac dinh duoc dan phuong cu).
// - Phu/Tran legacy RETIRED (sec.10.1): talismans/formations in the Bag
//   + socket state on slots convert to Linh Thach per the compensation
//   table (common 200 / uncommon 500 / rare 1200); all socket state is
//   dropped. Rolled affixes on equipment are KEPT (sec.10.1.5).
// - Buildings trung gian bi loai bo (herb_garden/smelter/
//   artisan_workshop/formation_altar/talisman_institute): hoan tra Linh
//   Thach theo bang co dinh /level; strip gardenPlots/processingJobs.
// - Tao productionSites (3 nguon Thanh Van level 1, idle) + alchemyJobs
//   rong + Diem Ren per-item (da chuyen sang EquipmentInstance, v46).
// - Exploration/crafts legacy bo khoi schema (he thong da xoa).
// version 45 (2026-08-26, combat-gate-teleport-autocast-rework): player:
// PlayerData them field BAT BUOC MOI `combatAiStrategy: CombatAiStrategy`
// (AI target strategy, xem core/battle/CombatAiStrategy.ts). Restore
// validate: thieu/sai -> fallback 'nearest' (plan sec10.2 - development
// build, KHONG viet migration). Save cu (v44) khong tuong thich theo
// convention "moi thay doi schema deu bump".
// version 46 (2026-08-26, diem ren per-item rework): PlayerData XOA
// refinementPoints/lastRefinementRegenAtMs (pool chung + regen); Diem Ren
// per-item DUNG LAI forgePoints/forgePotential co san tren instance
// (tooltip "Tinh trang ren x/y") - Tay/Tinh Luyen tru thang forgePoints.
// Save v45 khong tuong thich theo convention development build - khong migration.
// version 47 (2026-08-26, node level plan sec6.1): PlayerData them field
// BAT BUOC MOI `nodeLevels: Record<string, number>` (nguon su that cap
// node, xem core/progression/NodeSystem.ts). Save v46 CU (truoc khi co
// field giua chuoi v46) thieu nodeLevels - tung gay crash getNodeLevel
// luc boot khien nguoi choi khong the toi Settings de Xoa Save; gio
// route thang qua SaveIncompatibleScreen (Xuat/Xoa) dung UX recovery.
// version 48 (2026-08-26, dong-fu-command-wheel-inventory-spirit-stone
// plan Workstream F): PlayerData XOA field `spiritStone` - Linh Thach
// la MATERIAL trong MaterialBag (stack 'spirit_stone', xem
// core/material/SpiritStoneMaterial.ts), KHONG migration (development
// phase). Save v47 va moi version cu hon -> 'incompatible'.
// version 49: catalog dan/linh thao duoc thay bang dung tam ho theo pham.
// Development build khong migration: save v48 tro xuong buoc reset ro rang.
// version 50: loai hoan toan Linh Chi/Que/Cuc Hoa va moi linh thao
// luyen dan legacy khoi registry/drop table runtime. Save v49 co the
// con stack legacy nen buoc reset, khong migration trong development.
// version 51 (2026-08-27, Quest System v1): GameSave them field MOI
// `quests?: QuestManagerState` (active quest progress + completedOnceIds
// + lastDailyResetAtMs, xem core/quest/QuestManager.ts). Khong migration
// (development phase) - save v50 va cu hon -> 'incompatible', buoc
// Xuat/Xoa qua SaveIncompatibleScreen.
// version 52 (2026-08-28, talent-direction-choice-plan sec6): PlayerData
// them field `cultivationInsightAccumulator: number` (thien phu Ngo Dao
// tich luy tu vi doi Cam Ngo Ky nang, xem stores/player.ts's cultivate()).
// Khong migration (development phase) - save v51 va cu hon -> 'incompatible'.
//
// 2026-08-28 (save-shape-validation-plan.md, KHONG bump version vi khong
// doi schema): loadGame()/importSaveRaw() chay validateGameSaveShape()
// sau khi version khop - save dung version nhung thieu/hong field bat
// buoc tra 'corrupted' (load) hoac bi tu choi (import) thay vi crash
// boot o restoreFromSave() hay NaN cultivation vinh vien.

/** Settings phat su kien nay de App dung autosave truoc khi xoa save. */
export const SAVE_RESET_REQUEST_EVENT = 'tien-hiep:reset-save-requested'

/**
 * Exact App restore order. Registry drift is rejected before Pinia, active-player,
 * or manager state can mutate; valid saves then restore through the existing owners.
 */
export function restoreGameSession(
  player: GameSessionPlayerOwner,
  gameManager: GameManager,
  save: GameSave,
  timeAuthority?: RestoreTimeAuthority,
): RestoreGameSessionResult {
  try {
    gameManager.saveOps.preflightSaveRegistryReferences(save)
  } catch (error: unknown) {
    return {
      status: 'rejected',
      message: error instanceof Error ? error.message : 'Save registry preflight failed',
    }
  }

  // M1 (ARCH-001) - a mid-restore failure is a handled rejection, not an
  // uncaught boot exception. Identity hashes commit only after each owner
  // finished applying, so retrying the same payload re-applies the
  // un-committed slices instead of skipping them.
  try {
    const offline = player.restoreFromSave(save, timeAuthority)

    gameManager.setActivePlayer(player.$state)

    const equipmentModifiers = gameManager.saveOps.restoreFromSave(save, timeAuthority)

    player.setEquipmentModifiers(equipmentModifiers)

    return { status: 'ok', offline }
  } catch (error: unknown) {
    return {
      status: 'rejected',
      message: error instanceof Error ? error.message : 'Session restore failed',
    }
  }
}

/**
 * M1 (ARCH-001) - the snapshot-boundary detach. EVERY GameSave slice
 * must be a detached VALUE: mutating live manager state after the build,
 * or mutating the built save itself, must never reach the other side.
 *
 * JSON round-trip, NOT structuredClone: a save is also built from a
 * Pinia store's reactive $state (the player slice), and structuredClone
 * has no concept of Proxy exotic objects at ANY nesting depth - it throws
 * DataCloneError the moment it meets one, including a nested field Vue
 * only wrapped in a Proxy lazily after some earlier getter/computed
 * touched it during actual gameplay (toRaw() alone is not sufficient -
 * it only unwraps the outermost proxy). JSON.stringify/parse reads
 * through Proxies transparently at any depth, and the built save is
 * exactly what writeGameSave() serializes to localStorage anyway - the
 * in-memory snapshot now equals its persisted form byte-for-byte.
 */
function detachSaveValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function buildGameSave(player: PlayerData, gameManager: GameManager): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,

    player: {
      ...detachSaveValue(player),

      lastSavedAt: Date.now(),
    },

    // Manager getters intentionally return LIVE domain objects for
    // gameplay consumers - the detach happens HERE, at the save
    // boundary, so every slice in the returned save is a value copy.
    techniques: detachSaveValue(gameManager.techniqueManager.getAll()),

    skills: detachSaveValue(gameManager.skillManager.getAll()),

    materials: detachSaveValue(gameManager.materialBag.getAll().map((stack) => ({
      materialId: stack.material.id,

      amount: stack.amount,
    }))),

    equipment: detachSaveValue(gameManager.equipmentBag.getAll()),

    pills: detachSaveValue(gameManager.pillBag.getAll().map((stack) => ({
      pillId: stack.pill.id,

      amount: stack.amount,
    }))),

    // Phu/Tran khai tu (sec10.1) - bag khong con; mang rong giu shape save.
    talismans: [],

    formations: [],

    buildings: detachSaveValue(gameManager.buildingManager.getAll()),

    equipmentSlots: detachSaveValue(gameManager.equipmentSlotManager.getAll()),

    productionSites: detachSaveValue(gameManager.productionSystem.getAllStates().map((state) => ({
      siteId: state.siteId,

      level: state.level,

      autoRestart: state.autoRestart,

      workerCycles: state.workerCycles?.length ? state.workerCycles : undefined,

      // Mission A2 - manual allocation must persist; runtime-only
      // activeWorkerSlots stays derived from live capacity (not saved).
      assignedWorkers: state.assignedWorkers,

      // M-F-BODY-HIDDEN (v81) - grotto hidden-channel settle counters.
      hiddenChannelCycles: state.hiddenChannelCycles,
    }))),

    alchemyJobs: detachSaveValue(gameManager.alchemySystem.getJobs()),

    quests: detachSaveValue(gameManager.questManager.getState()),

    // R7 (AR-08) - detached decompose snapshot (getSaveState returns a
    // value copy; detachSaveValue keeps it independent of live state).
    decompose: detachSaveValue(gameManager.decomposeSystem.getSaveState()),

    // F-W-5 (v82) - tribulation director runtime: committed outcome +
    // cooldown survive reload. Slice vang mat khi khong co gi pending.
    tribulation: (() => {
      const runtime = gameManager.tribulationDirector.serializeRuntime()
      return Object.keys(runtime).length > 0 ? detachSaveValue(runtime) : undefined
    })(),
  }
}

export type SaveWriteResult = { status: 'ok' } | { status: 'failed'; reason: 'quota' | 'unknown' }

export function writeGameSave(save: GameSave): SaveWriteResult {
  try {
    localStorage.setItem(resolveSaveKey(), JSON.stringify(save))
    return { status: 'ok' }
  } catch (error: unknown) {
    // QuotaExceededError (DOMException name) - save vuot ~5MB localStorage.
    // Khong throw: caller (CloudSaveCoordinator -> autosave) quyet dinh cach
    // bao cho nguoi choi thay vi chet im lang giua tick.
    const name = error instanceof DOMException ? error.name : String(error)
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { status: 'failed', reason: 'quota' }
    }
    return { status: 'failed', reason: 'unknown' }
  }
}

// Phase 5 (Reliability, muc XVI) - truoc day version khong khop hoac
// JSON hong deu tra ve null giong het "chua tung co save", khien
// App.vue coi la nhan vat moi va AM THAM ghi de save cu o lan save()
// ke tiep. Gio phan biet ro 3 truong hop de App.vue chan boot, bao
// nguoi choi, va de ho tu quyet (Export/Xoa) thay vi mat trang khong
// biet vi sao - xem SaveIncompatibleScreen.vue.
export type LoadOutcome =
  | { status: 'empty' }
  // `raw` rides along so a rejected-after-shape save can still be
  // exported byte-identically (same contract as the incompatible/
  // corrupted branches) - the normalized object silently drops
  // shape-discarded entries and key order.
  | { status: 'ok'; save: GameSave; discardedEquipmentCount: number; raw: string }
  | { status: 'incompatible'; foundVersion: number | undefined; raw: string }
  | { status: 'corrupted'; raw: string }
  // Mission A review (MA-R2-02) - storage access itself threw
  // (SecurityError/denied). Deliberately NOT 'empty': callers must not
  // start a new character over an unreadable existing save.
  | { status: 'storage_unavailable' }

// F2 / INV-F-19 - inspectLocalSave() is the PURE read half of the
// pipeline: raw -> parse -> version -> shape, with zero consumption.
// The one-shot import-handoff marker stays untouched, so a preflight
// reader (remote newest-wins) can never eat the count the real owner
// load is supposed to report. loadGame() = inspect + consume.
export type InspectedSave =
  | { status: 'empty' }
  | {
      status: 'ok'
      save: GameSave
      raw: string
      shapeDiscardedEquipmentCount: number
    }
  | { status: 'incompatible'; foundVersion: number | undefined; raw: string }
  | { status: 'corrupted'; raw: string }
  | { status: 'storage_unavailable' }

export function inspectLocalSave(): InspectedSave {
  let raw: string | null

  try {
    raw = localStorage.getItem(resolveSaveKey())
  } catch {
    return { status: 'storage_unavailable' }
  }

  if (!raw) {
    return { status: 'empty' }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupted', raw }
  }

  const foundVersion = (parsed as { version?: unknown })?.version

  if (typeof foundVersion !== 'number') {
    return {
      status: 'incompatible',
      foundVersion: undefined,
      raw,
    }
  }

  // Development-phase policy (dong-fu-command-wheel-inventory-spirit-
  // stone-plan.md sec"Chinh sach migration") - KHONG con auto-migration
  // nao: moi version cu hon CURRENT_SAVE_VERSION tra ve 'incompatible'
  // de SaveIncompatibleScreen cho phep Export/Xoa. Dieu nay bao dam
  // khong bao gio co writeGameSave() phat sinh tu loadGame() (truoc day
  // nhanh v42/v43 ghi de save goc ma khong backup va gan thang version
  // hien hanh du thieu field cua schema moi).
  if (foundVersion !== CURRENT_SAVE_VERSION) {
    return {
      status: 'incompatible',
      foundVersion,
      raw,
    }
  }

  // save-shape-validation-plan.md sec3.4 - version khop CHUA du: save thieu
  // array/field bat buoc (vd player.nodeLevels thoi v47) tung gay crash
  // boot hoac NaN cultivation vinh vien o restoreFromSave(). Phat hien
  // co chu dich tai day de SaveIncompatibleScreen xu ly (Xuat/Xoa).
  const shape = validateGameSaveShape(parsed)

  if (!shape.ok) {
    console.warn('[SaveSystem] Save đúng version nhưng sai shape:', shape.issues)

    return { status: 'corrupted', raw }
  }

  return {
    status: 'ok',
    save: shape.normalizedSave as GameSave,
    raw,
    shapeDiscardedEquipmentCount: shape.discardedEquipmentCount,
  }
}

export function loadGame(): LoadOutcome {
  const inspected = inspectLocalSave()

  switch (inspected.status) {
    case 'empty':
    case 'storage_unavailable':
      return { status: inspected.status }
    case 'incompatible':
      return {
        status: 'incompatible',
        foundVersion: inspected.foundVersion,
        raw: inspected.raw,
      }
    case 'corrupted':
      return { status: 'corrupted', raw: inspected.raw }
  }

  const raw = inspected.raw

  // Handoff marker is auxiliary - a read failure degrades to "no
  // marker" (count lost, save still loads) instead of failing the load.
  let importedHandoffRaw: string | null = null

  try {
    importedHandoffRaw = localStorage.getItem(
      resolveImportHandoffKey(),
    )
  } catch {
    importedHandoffRaw = null
  }

  let importedDiscardedCount = 0

  if (importedHandoffRaw) {
    let importedHandoff: unknown

    try {
      importedHandoff = JSON.parse(importedHandoffRaw)
    } catch {
      importedHandoff = undefined
    }

    if (
      typeof importedHandoff === 'object' &&
      importedHandoff !== null &&
      'normalizedRaw' in importedHandoff &&
      importedHandoff.normalizedRaw === raw &&
      'discardedEquipmentCount' in importedHandoff &&
      Number.isSafeInteger(importedHandoff.discardedEquipmentCount) &&
      typeof importedHandoff.discardedEquipmentCount === 'number' &&
      importedHandoff.discardedEquipmentCount > 0
    ) {
      importedDiscardedCount = importedHandoff.discardedEquipmentCount
    }

    // OPT-06 - removeItem chay SAU khi doc + consume xong (truoc day
    // xoa ngay truoc khi parse). Chi cham storage khi key thuc su ton
    // tai; handoff khong con gia tri su dung sau load hop le nen van
    // bi xoa ke ca khi marker lech normalizedRaw (rac). Y do cu giu
    // nguyen: moi duong return truoc (parse fail, version, shape) nam
    // TRUOC block nay nen handoff con nguyen cho lan load hop le.
    try {
      localStorage.removeItem(resolveImportHandoffKey())
    } catch {
      // Marker persists harmlessly - next valid load consumes/removes it.
    }
  }

  return {
    status: 'ok',
    save: inspected.save,
    raw,
    discardedEquipmentCount:
      inspected.shapeDiscardedEquipmentCount + importedDiscardedCount,
  }
}

// Sao luu save hien co vao BACKUP_KEY - goi TRUOC moi thao tac co
// the xoa/ghi de save chinh (deleteSave(), importSaveRaw()), de luon
// con 1 buoc lui qua restoreBackup() neu nguoi choi bam nham.
// Mission A5 - storage throw (quota/SecurityError) thi tra false thay
// vi lam caller crash: backup la best-effort, khong duoc pha flow chinh.
export function backupCurrentSave(): boolean {
  try {
    const raw = localStorage.getItem(resolveSaveKey())

    if (raw) {
      localStorage.setItem(resolveBackupKey(), raw)
    }

    return true
  } catch {
    return false
  }
}

export function hasBackup(): boolean {
  try {
    return localStorage.getItem(resolveBackupKey()) !== null
  } catch {
    return false
  }
}

export function getRawSave(): string | null {
  try {
    return localStorage.getItem(resolveSaveKey())
  } catch {
    return null
  }
}

export function restoreBackup(): boolean {
  try {
    const raw = localStorage.getItem(resolveBackupKey())

    if (!raw) {
      return false
    }

    // Xoa handoff TRUOC khi ghi: neu removeItem throw thi SAVE_KEY con
    // nguyen va `false` phan anh dung "chua restore gi" (ghi truoc xoa
    // sau se bao false du backup da duoc restore).
    localStorage.removeItem(resolveImportHandoffKey())
    localStorage.setItem(resolveSaveKey(), raw)

    return true
  } catch {
    // Mission A5 - storage throw -> bao that bai thay vi crash recovery UI.
    return false
  }
}

// Mission A review (MA-R2-01) - returns observable success: callers
// must only reload on `true`, otherwise a swallowed removeItem failure
// would reload into the same corrupt save the user just tried to
// delete. Every key is attempted even when one throws - aborting the
// loop early could leave a stale SAVE_REVISION_KEY that fails the next
// character's first CAS write.
export function deleteSave(): boolean {
  // Best-effort: backup fail (quota/SecurityError) KHONG chan xoa -
  // nguoi choi da xac nhan mat save.
  void backupCurrentSave()

  let ok = true

  // B1-C: a user-confirmed reset also drops the remote-mode durable
  // envelopes (pending journal / acked cache / quarantine) bound to this
  // account - the server row stays the authority, and dropping the
  // journal releases a permanently-unresolved pending for export-or-drop.
  const keys = [
    resolveSaveKey(),
    resolveImportHandoffKey(),
    resolveRevisionKey(),
    ...listSaveEnvelopeKeys(),
  ]

  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      ok = false
    }
  }

  return ok
}

// Tai save hien co (bat ke doc duoc hay khong) xuong file .json -
// duong thoat an toan that su cho save khong tuong thich/hong, vi
// BACKUP_KEY van nam trong cung localStorage nen mat theo neu nguoi
// dung xoa site data.
// `provenance` (B1.9a) stamps source + revision onto the filename so a
// cloud-acked export is distinguishable from a local-slot or
// validated-import one.
export function exportSaveToFile(raw: string, provenance?: ExportProvenance) {
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')

  link.href = url
  link.download = exportFilename(provenance, Date.now())
  link.click()

  URL.revokeObjectURL(url)
}

// Import a player-chosen .json save: parse must succeed and `version`/`player`
// fields must exist; a save at EXACTLY the current version must also pass
// validateGameSaveShape before writing - stops a broken save overwriting a
// good one at the import gate. A DIFFERENT version is still written (the
// reload's loadGame() then classifies it 'incompatible' and offers
// Export/Delete via SaveIncompatibleScreen - the existing recovery flow).
// Back up the current save (if any) before overwriting.
export function importSaveRaw(raw: string): boolean {
  let parsed: unknown
  let normalizedRaw = raw
  let discardedEquipmentCount = 0

  try {
    parsed = JSON.parse(raw)
  } catch {
    return false
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('player' in parsed)
  ) {
    return false
  }

  // Enforce shape only at the current version - other versions are left
  // for loadGame()'s 'incompatible' path (keeps the user's recovery route).
  if ((parsed as { version?: unknown }).version === CURRENT_SAVE_VERSION) {
    const shape = validateGameSaveShape(parsed)

    if (!shape.ok) {
      return false
    }

    // Acceptance parity (F-INT-03): the third acceptance seam applies
    // the SAME predicate as restore preflight + the remote gate - a
    // file the boot restore would reject must not overwrite a healthy
    // save slot (the old shape-only check let contract-bad imports
    // poison local AND remote before the recovery surface appeared).
    if (!isSaveAcceptable(shape.normalizedSave as GameSave, staticSaveAcceptanceCatalogs())) {
      return false
    }

    normalizedRaw = JSON.stringify(shape.normalizedSave)
    discardedEquipmentCount = shape.discardedEquipmentCount
  }

  // Prepare the handoff BEFORE touching backup/main save. If storage
  // cannot accept the marker the import fails intact rather than writing
  // a save but losing the counter. Exact normalizedRaw binds the marker
  // to the right payload.
  // Snapshot the prior marker first: a pending marker written by the
  // other seam (remote pull writes it after its save) belongs to the
  // CURRENT save, so a later abort must restore it.
  const handoffKey = resolveImportHandoffKey()
  let priorMarker: string | null = null
  try {
    priorMarker = localStorage.getItem(handoffKey)
  } catch {
    // getItem failure means the prep below fails too - abort intact.
  }
  const restorePriorMarker = (): void => {
    try {
      if (priorMarker === null) {
        localStorage.removeItem(handoffKey)
      } else {
        localStorage.setItem(handoffKey, priorMarker)
      }
    } catch {
      // Restore fail = same degraded channel a marker read failure produces.
    }
  }
  try {
    if (discardedEquipmentCount > 0) {
      localStorage.setItem(
        handoffKey,
        JSON.stringify({ normalizedRaw, discardedEquipmentCount }),
      )
    } else {
      localStorage.removeItem(handoffKey)
    }
  } catch {
    return false
  }

  // Mission A5 - backup failure aborts the import intact: overwriting,
  // the only save without a written safety net is the unsafe outcome,
  // so a failed backup returns false with SAVE_KEY untouched.
  if (!backupCurrentSave()) {
    restorePriorMarker()
    return false
  }

  try {
    localStorage.setItem(resolveSaveKey(), normalizedRaw)
  } catch {
    restorePriorMarker()
    return false
  }

  return true
}
