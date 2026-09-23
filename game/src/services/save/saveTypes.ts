import type { PlayerData } from '../../core/player/Player'
import type { Technique } from '../../core/technique/Technique'
import type { Skill } from '../../core/skill/Skill'
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'
import type { BuildingInstance } from '../../core/building/BuildingInstance'
import type { EquipmentSlotState } from '../../core/equipment/EquipmentSlotState'
import type { QuestManagerState } from '../../core/quest/QuestManager'
import type { DecomposeSaveState } from '../../core/production/DecomposeSystem'
import type { OfflineResult } from '../../core/idle/OfflineProgressSystem'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { CURRENT_SAVE_VERSION } from './saveVersion'

export interface MaterialStackSave {
  materialId: string

  amount: number
}

export interface PillStackSave {
  pillId: string

  amount: number
}

export interface TalismanStackSave {
  talismanId: string

  amount: number
}

export interface FormationStackSave {
  formationId: string

  amount: number
}

// version 2: mo rong tu { version, player } (chi luu PlayerData) -
// truoc day skill/technique da hoc, 4 loai inventory, va tham hiem
// dang chay deu mat khi reload. Manager nao luu id thay vi full
// object (materials/pills/talismans) deu resolve lai qua registry
// tuong ung luc restore - xem GameManager.restoreFromSave().
// version 3: adds formations (FormationBag) - formations ride the
// existing `equipment` field, no separate field needed.
// version 4: them crafts (CraftingManager) - luot craft Dan/Phu/
// Tran dang chay, nguyen lieu da tru nen phai luu lai tien do,
// khong thi reload giua chung se mat trang nguyen lieu da tieu.
// version 5: tai cau truc toan bo he thong stat (nen Last Epoch) -
// PlayerData.baseStats doi han shape (bo magicAttack/magicDefense/
// elementAffinity, them attribute + co che moi). Save cu (version <5)
// khong tuong thich, KHONG viet migration (doi qua sau, khong dang -
// save cu tu dong bi coi nhu khong ton tai, xem loadGame()).
// version 6: hoan thien stat (Mana Regen/CDR/Crit Avoidance/Chance
// Ignore Resistance/Ailment Resist & Potency, tag-hierarchy Increased)
// + he thong Tam Phap 3 tang (Tu Luyen/Chien Dau/Pha Canh - Technique
// doi han shape sang discriminated union, xem core/technique/Technique.ts).
// PlayerData gains totalMonstersKilled. Old
// saves (version <6) are INCOMPATIBLE, no migration written - same
// reason as version 5: old saves are treated as absent.
// version 7: MASTER SPEC Economy Phase 4 - them Building (Farm/Mine/
// Smelter...), luu buildings: BuildingInstance[] (xem
// core/building/*). Save cu (version <7) KHONG tuong thich, khong
// viet migration - cung ly do cac version truoc.
// version 8: MASTER SPEC Muc XVI (Economy Phase 9) - Cuong Hoa/Khac
// Tran/Yem Phu chuyen tu EquipmentInstance sang EquipmentSlotState
// (gan theo SLOT, khong theo item cu the - xem core/equipment/
// EquipmentSlotState.ts), luu equipmentSlots: EquipmentSlotState[].
// EquipmentInstance in saves no longer has the enhanceLevel field. Old
// saves (version <8) are INCOMPATIBLE, no migration written - same
// reason as previous versions.
// version 9: Core Loop Foundation checklist (Muc AFFIX/RARITY) -
// EquipmentInstance doi `substats: StatModifier[]` thanh
// `affixes: RolledAffix[]` (xem core/equipment/RolledAffix.ts) + them
// field `rarity: EquipmentRarity` (xem core/equipment/EquipmentRarity.ts).
// version 10: Dot Pha Truc Co (Phase 1) - xoa PlayerData.pillUsageCount
// + Pill.usageLimit, thay bang tran theo canh gioi (RealmData.attributeCap,
// xem PillSystem.canUse()).
// version 11: Dot Pha Truc Co (Phase 5) - them
// PlayerData.highestFoundationAchieved (muc 16 spec `breakthrough`).
// version 12: Home Hub (Phase 2).
// version 13: Beta Phase 4 (Tutorial) - them PlayerData.hasSeenTutorial.
// version 14: BUILDing spec (Building System rework) - ActiveCraft
// (crafts: ActiveCraft[]) doi field: them craftId bat buoc (xem
// core/recipe/CraftingManager.ts - ho tro nhieu luot craft song song
// cung resultType, truoc day dinh danh bang resultType nen chi 1
// luot/loai). buildings: BuildingInstance[] gio co the chua 4
// building crafting_station moi (pill_room/formation_altar/
// talisman_institute/equipment_hall - truoc day 4 panel nay KHONG
// gan Building nao, gio bat buoc xay truoc khi dung, xem
// BuildingConstructionGate.vue).
// version 15: Equipment Rework - equipment: EquipmentInstance[] doi
// field: `rarity` gio la 1 trong 4 gia tri moi (vo_duyen/tieu_duyen/
// ky_duyen/thien_duyen, bo han 'normal'/'magic'/'rare'/'exalted'/
// 'unique' cu), `refineLevel` bi XOA thay bang `forgePoints` (xem
// core/equipment/EquipmentSystem.ts's forge()/refine()). Equipment
// template (dang ky luc bootstrap, khong nam trong save) mat
// `fixedAffixes`, them `forgeCost`.
// version 16: Tham Hiem rework - old saves (version <16) are
// INCOMPATIBLE, no migration written - same reason as previous
// versions.
// version 17: Naming-principles pass ("nguyen li dat ten") -
// equipment: EquipmentInstance[]'s `rarity` doi han value set - 5 bac
// Ngu Pham moi (hoang_pham/huyen_pham/dia_pham/thien_pham/tien_pham,
// xem core/item/Pham.ts) thay 4 bac "Duyen" cu (vo_duyen/tieu_duyen/
// ky_duyen/thien_duyen). Pill/Talisman/Formation template (dang ky luc
// bootstrap, khong nam trong save) doi `grade: number` -> `grade: ItemGrade`
// - khong anh huong save vi do la template, chi liet ke o day de de
// tra cuu.
// version 18: "EquipemtnQuality&rarity" + "tunghematandsuch" pass -
// equipment: EquipmentInstance[] them field BAT BUOC MOI
// `forgePotential: number` (0-100, Tiem Nang Ren - xem
// core/equipment/EquipmentSystem.ts's rollForgePotential()). materials:
// MaterialStackSave[] co the tham chieu id material MOI (yeu_dan_qi_refining/
// yeu_huyet_qi_refining/yeu_cot_qi_refining/bui_cot/tinh_luyen_cot/...) -
// save cu tham chieu id DA XOA (wolf-fang/wolf-hide/demon-core/13
// material trophy tang 1-10) se bi MaterialRegistry bo qua khi restore
// (registry.has() guard co san, khong throw) nhung coi la KHONG tuong
// thich o day vi stat/economy da doi qua nhieu de tu dong migrate.
// version 19: Phap Tu profession-tier ladder - player: PlayerData them
// field TUY CHON `cultivationPath?: CultivationPathId` (xem
// core/player/CultivationPathKit.ts). Optional nen ve mat du lieu save
// cu van doc duoc (undefined = Pham Nhan, dung default hien tai cua
// MOI nhan vat) - van bump version theo dung convention "moi thay doi
// schema deu bump" da ap dung nhat quan tu version 11 tro di, de
// CURRENT_SAVE_VERSION luon phan anh dung shape PlayerData hien hanh.
// version 20: Tam Phap hop nhat - techniques: Technique[] doi HAN
// shape (3 loai cultivation/combat/breakthrough voi field rieng tung
// loai -> 1 interface phang duy nhat, moi field vai tro cu the gio
// optional, xem core/technique/Technique.ts). Save cu (version <20)
// co `technique.type`/`minorBreakthroughGrant`/`majorRealmEnhancements`
// KHONG khop shape moi - khong viet migration, cung convention moi
// version truoc.
// version 21: Kiem Tu - player: PlayerData them field BAT BUOC MOI
// `totalCultivationGained: number` (dem tu vi suot doi - sau nay nguon
// tier Kiem Y chuyen sang bossKillCount, xem KiemYSystem.ts). Save cu
// thieu field nay - khong viet migration, cung convention moi version
// truoc.
// version 53 (2026-08-29, kiem-the-kiem-y spec): them
// `bossKillCount: number` (tang Kiem Y vinh vien theo boss diet);
// swordPathRoute chot vinh vien luc chon path; go skill Kiem Tu cu (moi
// route 1 active skill); go rage. Chi tiet xem saveVersion.ts.
// version 54 (2026-08-29, dot-pha-loi-kiep spec): them 4 field BAT
// BUOC `openedMeridianIds: string[]` (Bat Mach da thong),
// `luyenKhiKillsSinceBeast: number` (cua so quai an),
// `mortalPerfectionAchieved: boolean` (snapshot hoan hao Pham Nhan),
// `greatDaoOpportunityLost: boolean` (mat vinh vien Dai Dao). Go Dot
// Pha Lenh (token materials) + quai Kiep. Save v53 bi tu choi (dev
// phase, khong migration). Chi tiet xem saveVersion.ts.
// version 65 (2026-09-16, cultivation-path-framework M2): player them
// field TUY CHON `cultivationWay?: CultivationWayId` (way trong path, xem
// core/player/CultivationPathKit.ts). M7 (v66): `cultivationPath` thu
// con union 3 base id, cac id '_an' thanh way. Save v64 tro xuong bi
// tu choi - cung convention moi version truoc.
// version 81 (2026-09-23, M-F-BODY-HIDDEN): `luyenKhiKillsSinceBeast`
// (scalar, v54) becomes `hiddenBeastKills: Record<channelId, number>` -
// per-channel counter for the channel registry; ProductionSiteState
// gains OPTIONAL `hiddenChannelCycles` (grotto per-channel cycle
// counters). Save v80 and below is rejected - same convention as every
// prior version.
export interface GameSave {
  version: typeof CURRENT_SAVE_VERSION

  player: PlayerData

  techniques: Technique[]

  skills: Skill[]

  materials: MaterialStackSave[]

  equipment: EquipmentInstance[]

  pills: PillStackSave[]

  /** v44: luon rong - Phu legacy da khai tu, quy doi Linh Thach (sec.10.1). */
  talismans: TalismanStackSave[]

  /** v44: luon rong - Tran legacy da khai tu, quy doi Linh Thach (sec.10.1). */
  formations: FormationStackSave[]

  buildings: BuildingInstance[]

  equipmentSlots: EquipmentSlotState[]

  /** v44: state ba nguon Lam/Quang/Dong Thien (plan sec.4). */
  productionSites?: ProductionSiteStateSave[]

  /** v44: job luyen dan dang chay (plan sec.8.2). */
  alchemyJobs?: AlchemyJobSave[]

  /** v51: state Quest System (active progress + completedOnceIds + daily reset moc). */
  quests?: QuestManagerState

  /** R7 (AR-08): decompose settings + cycle timer. Optional - old
   * development saves lack the slice (E8: no migration needed). */
  decompose?: DecomposeSaveState
}

export interface GameSessionPlayerOwner {
  readonly $state: PlayerData

  restoreFromSave(save: GameSave): OfflineResult

  setEquipmentModifiers(modifiers: StatModifier[]): void
}

export type RestoreGameSessionResult =
  | { status: 'ok'; offline: OfflineResult }
  | { status: 'rejected'; message: string }

/**
 * R10 (AR-12) - whole-payload restore identity. A partial fingerprint
 * (lastSavedAt|cultivation) is not proof that a payload is unchanged:
 * two DIFFERENT saves can share those two fields and the old guard
 * restored the wrong (first) payload.
 *
 * M1 (ARCH-001) - the identity covers EVERY declared GameSave slice, not
 * just materials/quests: a pills-only change (or any other single-slice
 * difference) is a different payload and must re-run restore. The ONLY
 * documented exclusion stays `player.lastSavedAt` - re-saving identical
 * content with a new timestamp still converges on retry. Absent optional
 * slices hash as `null` and are distinguished from present-but-empty
 * ones (`[]`), since presence-vs-absence is itself a payload difference.
 */
export function computeRestoreIdentity(save: GameSave): string {
  const { lastSavedAt: _excluded, ...playerWithoutTimestamp } = save.player

  void _excluded

  return JSON.stringify([
    save.version,
    playerWithoutTimestamp,
    save.techniques,
    save.skills,
    save.materials,
    save.equipment,
    save.pills,
    save.talismans,
    save.formations,
    save.buildings,
    save.equipmentSlots,
    save.productionSites ?? null,
    save.alchemyJobs ?? null,
    save.quests ?? null,
    save.decompose ?? null,
  ])
}

export interface ProductionCycleSave {
  cycleId: string

  siteId: string

  collectionRealmId: string

  siteLevelAtStart: number

  rewardTableVersion: number

  rollSeed: number

  startedAtMs: number

  completesAtMs: number
}

/** Shape persist cua ProductionSiteState - khop core/production. */
export interface ProductionSiteStateSave {
  siteId: string

  level: number

  autoRestart: boolean

  // 2026-08-28 (economy-ecosystem-plan T3) - worker cycle do dang truoc
  // day KHONG duoc persist: mat trang tien trinh moi lan reload va worker
  // khong san xuat offline. Gio luu lai de settleOffline chay tiep trong cap.
  workerCycles?: ProductionCycleSave[]

  // Mission A2 - manual worker allocation declared at v55 but dropped by
  // the serializer until now; undefined = AUTO (round-robin) per
  // ProductionSiteState.
  assignedWorkers?: number

  // M-F-BODY-HIDDEN (v81) - grotto per-channel settle-cycle counters;
  // mirrors ProductionSiteState.hiddenChannelCycles.
  hiddenChannelCycles?: Record<string, number>
}

/** Shape persist cua ActiveAlchemyJob - khop core/alchemy. */
export interface AlchemyJobSave {
  jobId: string

  recipeId: string

  pillId: string

  herbMaterialId: string

  startedAtMs: number

  completesAtMs: number

  roomLevelAtStart: number
}

