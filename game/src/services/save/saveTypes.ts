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

// version 2: mở rộng từ { version, player } (chỉ lưu PlayerData) —
// trước đây skill/technique đã học, 4 loại inventory, và thám hiểm
// đang chạy đều mất khi reload. Manager nào lưu id thay vì full
// object (materials/pills/talismans) đều resolve lại qua registry
// tương ứng lúc restore — xem GameManager.restoreFromSave().
// version 3: thêm formations (FormationBag) — formation đi theo
// `equipment` sẵn có, không cần field riêng.
// version 4: thêm crafts (CraftingManager) — lượt craft Đan/Phù/
// Trận đang chạy, nguyên liệu đã trừ nên phải lưu lại tiến độ,
// không thì reload giữa chừng sẽ mất trắng nguyên liệu đã tiêu.
// version 5: tái cấu trúc toàn bộ hệ thống stat (nền Last Epoch) —
// PlayerData.baseStats đổi hẳn shape (bỏ magicAttack/magicDefense/
// elementAffinity, thêm attribute + cơ chế mới). Save cũ (version <5)
// không tương thích, KHÔNG viết migration (đổi quá sâu, không đáng —
// save cũ tự động bị coi như không tồn tại, xem loadGame()).
// version 6: hoàn thiện stat (Mana Regen/CDR/Crit Avoidance/Chance
// Ignore Resistance/Ailment Resist & Potency, tag-hierarchy Increased)
// + hệ thống Tâm Pháp 3 tầng (Tu Luyện/Chiến Đấu/Phá Cảnh — Technique
// đổi hẳn shape sang discriminated union, xem core/technique/Technique.ts).
// PlayerData thêm totalMonstersKilled. Save
// cũ (version <6) KHÔNG tương thích, không viết migration — cùng lý do
// version 5, save cũ tự động bị coi như không tồn tại.
// version 7: MASTER SPEC Economy Phase 4 — thêm Building (Farm/Mine/
// Smelter...), lưu buildings: BuildingInstance[] (xem
// core/building/*). Save cũ (version <7) KHÔNG tương thích, không
// viết migration — cùng lý do các version trước.
// version 8: MASTER SPEC Mục XVI (Economy Phase 9) — Cường Hóa/Khắc
// Trận/Yểm Phù chuyển từ EquipmentInstance sang EquipmentSlotState
// (gắn theo SLOT, không theo item cụ thể — xem core/equipment/
// EquipmentSlotState.ts), lưu equipmentSlots: EquipmentSlotState[].
// EquipmentInstance trong save không còn field enhanceLevel. Save cũ
// (version <8) KHÔNG tương thích, không viết migration — cùng lý do các
// version trước.
// version 9: Core Loop Foundation checklist (Mục AFFIX/RARITY) —
// EquipmentInstance đổi `substats: StatModifier[]` thành
// `affixes: RolledAffix[]` (xem core/equipment/RolledAffix.ts) + thêm
// field `rarity: EquipmentRarity` (xem core/equipment/EquipmentRarity.ts).
// version 10: Đột Phá Trúc Cơ (Phase 1) — xoá PlayerData.pillUsageCount
// + Pill.usageLimit, thay bằng trần theo cảnh giới (RealmData.attributeCap,
// xem PillSystem.canUse()).
// version 11: Đột Phá Trúc Cơ (Phase 5) — thêm
// PlayerData.highestFoundationAchieved (mục 16 spec `breakthrough`).
// version 12: Home Hub (Phase 2).
// version 13: Beta Phase 4 (Tutorial) — thêm PlayerData.hasSeenTutorial.
// version 14: BUILDing spec (Building System rework) — ActiveCraft
// (crafts: ActiveCraft[]) đổi field: thêm craftId bắt buộc (xem
// core/recipe/CraftingManager.ts — hỗ trợ nhiều lượt craft song song
// cùng resultType, trước đây định danh bằng resultType nên chỉ 1
// lượt/loại). buildings: BuildingInstance[] giờ có thể chứa 4
// building crafting_station mới (pill_room/formation_altar/
// talisman_institute/equipment_hall — trước đây 4 panel này KHÔNG
// gắn Building nào, giờ bắt buộc xây trước khi dùng, xem
// BuildingConstructionGate.vue).
// version 15: Equipment Rework — equipment: EquipmentInstance[] đổi
// field: `rarity` giờ là 1 trong 4 giá trị mới (vo_duyen/tieu_duyen/
// ky_duyen/thien_duyen, bỏ hẳn 'normal'/'magic'/'rare'/'exalted'/
// 'unique' cũ), `refineLevel` bị XOÁ thay bằng `forgePoints` (xem
// core/equipment/EquipmentSystem.ts's forge()/refine()). Equipment
// template (đăng ký lúc bootstrap, không nằm trong save) mất
// `fixedAffixes`, thêm `forgeCost`.
// version 16: Thám Hiểm rework — save cũ (version <16) KHÔNG tương
// thích, không viết migration — cùng lý do các version trước.
// version 17: Naming-principles pass ("nguyen li dat ten") —
// equipment: EquipmentInstance[]'s `rarity` đổi hẳn value set — 5 bậc
// Ngũ Phẩm mới (hoang_pham/huyen_pham/dia_pham/thien_pham/tien_pham,
// xem core/item/Pham.ts) thay 4 bậc "Duyên" cũ (vo_duyen/tieu_duyen/
// ky_duyen/thien_duyen). Pill/Talisman/Formation template (đăng ký lúc
// bootstrap, không nằm trong save) đổi `grade: number` -> `grade: ItemGrade`
// — không ảnh hưởng save vì đó là template, chỉ liệt kê ở đây để dễ
// tra cứu.
// version 18: "EquipemtnQuality&rarity" + "tunghematandsuch" pass —
// equipment: EquipmentInstance[] thêm field BẮT BUỘC MỚI
// `forgePotential: number` (0-100, Tiềm Năng Rèn — xem
// core/equipment/EquipmentSystem.ts's rollForgePotential()). materials:
// MaterialStackSave[] có thể tham chiếu id material MỚI (yeu_dan_qi_refining/
// yeu_huyet_qi_refining/yeu_cot_qi_refining/bui_cot/tinh_luyen_cot/...) —
// save cũ tham chiếu id ĐÃ XOÁ (wolf-fang/wolf-hide/demon-core/13
// material trophy tầng 1-10) sẽ bị MaterialRegistry bỏ qua khi restore
// (registry.has() guard có sẵn, không throw) nhưng coi là KHÔNG tương
// thích ở đây vì stat/economy đã đổi quá nhiều để tự động migrate.
// version 19: Pháp Tu profession-tier ladder — player: PlayerData thêm
// field TUỲ CHỌN `cultivationPath?: CultivationPathId` (xem
// core/player/CultivationPathKit.ts). Optional nên về mặt dữ liệu save
// cũ vẫn đọc được (undefined = Phàm Nhân, đúng default hiện tại của
// MỌI nhân vật) — vẫn bump version theo đúng convention "mỗi thay đổi
// schema đều bump" đã áp dụng nhất quán từ version 11 trở đi, để
// CURRENT_SAVE_VERSION luôn phản ánh đúng shape PlayerData hiện hành.
// version 20: Tâm Pháp hợp nhất — techniques: Technique[] đổi HẲN
// shape (3 loại cultivation/combat/breakthrough với field riêng từng
// loại -> 1 interface phẳng duy nhất, mọi field vai trò cụ thể giờ
// optional, xem core/technique/Technique.ts). Save cũ (version <20)
// có `technique.type`/`minorBreakthroughGrant`/`majorRealmEnhancements`
// KHÔNG khớp shape mới — không viết migration, cùng convention mọi
// version trước.
// version 21: Kiếm Tu — player: PlayerData thêm field BẮT BUỘC MỚI
// `totalCultivationGained: number` (đếm tu vi suốt đời — sau này nguồn
// tier Kiếm Ý chuyển sang bossKillCount, xem KiemYSystem.ts). Save cũ
// thiếu field này — không viết migration, cùng convention mọi version
// trước.
// version 53 (2026-08-29, kiem-the-kiem-y spec): thêm
// `bossKillCount: number` (tầng Kiếm Ý vĩnh viễn theo boss diệt);
// kiemTuRoute chốt vĩnh viễn lúc chọn path; gỡ skill Kiếm Tu cũ (mỗi
// route 1 active skill); gỡ rage. Chi tiết xem saveVersion.ts.
// version 54 (2026-08-29, dot-pha-loi-kiep spec): thêm 4 field BẮT
// BUỘC `openedMeridianIds: string[]` (Bát Mạch đã thông),
// `luyenKhiKillsSinceBeast: number` (cửa sổ quái ẩn),
// `mortalPerfectionAchieved: boolean` (snapshot hoàn hảo Phàm Nhân),
// `greatDaoOpportunityLost: boolean` (mất vĩnh viễn Đại Đạo). Gỡ Đột
// Phá Lệnh (token materials) + quái Kiếp. Save v53 bị từ chối (dev
// phase, không migration). Chi tiết xem saveVersion.ts.
// version 65 (2026-09-16, cultivation-path-framework M2): player thêm
// field TUỲ CHỌN `cultivationWay?: PathWayId` (way trong path, xem
// core/player/CultivationPathKit.ts). M7 (v66): `cultivationPath` thu
// còn union 3 base id, các id '_an' thành way. Save v64 trở xuống bị
// từ chối — cùng convention mọi version trước.
export interface GameSave {
  version: typeof CURRENT_SAVE_VERSION

  player: PlayerData

  techniques: Technique[]

  skills: Skill[]

  materials: MaterialStackSave[]

  equipment: EquipmentInstance[]

  pills: PillStackSave[]

  /** v44: luôn rỗng — Phù legacy đã khai tử, quy đổi Linh Thạch (§10.1). */
  talismans: TalismanStackSave[]

  /** v44: luôn rỗng — Trận legacy đã khai tử, quy đổi Linh Thạch (§10.1). */
  formations: FormationStackSave[]

  buildings: BuildingInstance[]

  equipmentSlots: EquipmentSlotState[]

  /** v44: state ba nguồn Lâm/Quáng/Động Thiên (plan §4). */
  productionSites?: ProductionSiteStateSave[]

  /** v44: job luyện đan đang chạy (plan §8.2). */
  alchemyJobs?: AlchemyJobSave[]

  /** v51: state Quest System (active progress + completedOnceIds + daily reset mốc). */
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
 * M1 (ARCH-001) — the identity covers EVERY declared GameSave slice, not
 * just materials/quests: a pills-only change (or any other single-slice
 * difference) is a different payload and must re-run restore. The ONLY
 * documented exclusion stays `player.lastSavedAt` — re-saving identical
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

/** Shape persist của ProductionSiteState — khớp core/production. */
export interface ProductionSiteStateSave {
  siteId: string

  level: number

  autoRestart: boolean

  // 2026-08-28 (economy-ecosystem-plan T3) — worker cycle dở dang trước
  // đây KHÔNG được persist: mất trắng tiến trình mỗi lần reload và worker
  // không sản xuất offline. Giờ lưu lại để settleOffline chạy tiếp trong cap.
  workerCycles?: ProductionCycleSave[]

  // Mission A2 — manual worker allocation declared at v55 but dropped by
  // the serializer until now; undefined = AUTO (round-robin) per
  // ProductionSiteState.
  assignedWorkers?: number
}

/** Shape persist của ActiveAlchemyJob — khớp core/alchemy. */
export interface AlchemyJobSave {
  jobId: string

  recipeId: string

  pillId: string

  herbMaterialId: string

  startedAtMs: number

  completesAtMs: number

  roomLevelAtStart: number
}

