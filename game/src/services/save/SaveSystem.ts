import type { PlayerData } from '../../core/player/Player'
import type { GameManager } from '../../core/game/GameManager'
import type { Technique } from '../../core/technique/Technique'
import type { Skill } from '../../core/skill/Skill'
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'
import type { ActiveExploration } from '../../core/exploration/ExplorationManager'
import type { ActiveCraft } from '../../core/recipe/CraftingManager'
import type { BuildingInstance } from '../../core/building/BuildingInstance'
import type { EquipmentSlotState } from '../../core/equipment/EquipmentSlotState'

const SAVE_KEY = 'tien-hiep-idle-save'

// Phase 5 (Reliability) — bản sao save TRƯỚC lần ghi đè/xoá gần nhất
// (deleteSave()), không phải lịch sử nhiều bản. Mục đích duy nhất:
// nếu người chơi bấm "Xoá & Bắt Đầu Mới" nhầm trên save không tương
// thích, dữ liệu cũ vẫn còn 1 bước để cứu qua restoreBackup() —
// KHÔNG thay thế Export (export mới là nơi an toàn thật sự, backup
// này nằm cùng localStorage nên mất theo nếu người dùng xoá site data).
const BACKUP_KEY = 'tien-hiep-idle-save-backup'

// v23: Thiên Công Phường rework — thêm building 'thien_cong_phuong',
// xoá hẳn exploration 'myriad-demon-forest' (Vạn Yêu Lâm), thêm
// 'wood-spirit-forest' (Mộc Lâm). Save cũ (version < 23) KHÔNG tương
// thích, không viết migration — save cũ có thể đang chạy dở
// exploration 'myriad-demon-forest' (nạp thẳng sẽ ORPHAN entry đó
// trong ExplorationManager: không throw, nhưng chiếm vĩnh viễn 1 slot
// concurrent mà không cách nào thu hoạch/huỷ vì id không còn trong
// registry).
// version 24: Pháp Tu Redesign (magicpath) — player: PlayerData thêm 3
// field BẮT BUỘC MỚI `skillPoints: number`/`unlockedElements: ElementType[]`/
// `equippedElements: ElementType[]` (xem core/element/ElementLoadout.ts,
// core/player/Player.ts), CỘNG THÊM baseStats (Stats) có thêm 6 field
// mới (windPower/windResistance/windPenetration/lightningPower/
// lightningResistance/lightningPenetration, xem core/element/ElementType.ts).
// Save cũ thiếu các field này — không viết migration, cùng convention
// mọi version trước.
// version 25: Pháp Tu Redesign — Node Tree, player: PlayerData thêm
// field BẮT BUỘC MỚI `purchasedNodeIds: string[]` (xem
// core/progression/NodeSystem.ts). CỘNG THÊM baseStats (Stats) thêm
// `manaShieldPercent` (Mana Shield). Save cũ thiếu các field này —
// không viết migration, cùng convention mọi version trước.
// version 26: Pháp Tu Redesign — Tâm Pháp không còn cộng chỉ số dưới
// bất kỳ hình thức nào (xoá `modifiers`/`mechanic`/`breakthroughEffect`
// khỏi Technique.ts) VÀ `cultivationRate` bị xoá HOÀN TOÀN khỏi Stats
// (baseStats mất field này, tốc độ tu luyện giờ cố định — xem
// core/realm/realmSystem.ts's BASE_CULTIVATION_PER_SECOND). Save cũ có
// `technique.modifiers`/`mechanic`/`breakthroughEffect` VÀ
// `baseStats.cultivationRate` KHÔNG khớp shape mới — không viết
// migration, cùng convention mọi version trước.
// version 27: Pháp Tu Redesign — gộp 5 CultivationPathId Ngũ Hành
// (phap_tu_hoa/moc/thuy/kim/tho) thành 1 "phap_tu" duy nhất (xem
// CultivationPathKit.ts) VÀ player: PlayerData xoá field
// `totalMonstersKilled` (mồ côi, xem RewardSystem.ts). Save cũ có
// `player.cultivationPath` là 1 trong 5 giá trị cũ (KHÔNG còn hợp lệ
// trong union mới) — không viết migration, cùng convention mọi version
// trước.
// version 28 (2026-08-20): Character/Cultivation/Skill/Inventory rework
// — player: PlayerData thêm field BẮT BUỘC MỚI `techniqueExperience:
// number` (thanh kinh nghiệm riêng của Tâm Pháp, xem
// core/technique/TechniqueTier.ts). Save cũ thiếu field này — không
// viết migration, cùng convention mọi version trước.
// version 29 (2026-08-20): Realm Passive & Pressure System — player:
// PlayerData thêm 4 field BẮT BUỘC MỚI `luyenTheCompletedTiers`/
// `luyenTheCurrentTierProgress`/`breakthroughGrade`/
// `grantedRealmPassiveIds` (Luyện Thể Phàm Nhân + Nhập Đạo/Kiến Cơ, xem
// core/realm/LuyenTheSystem.ts/RealmPassiveSystem.ts). Save cũ thiếu
// các field này — không viết migration, cùng convention mọi version
// trước.
// version 30 (2026-08-21): Hỏa FirePath redesign (Plans/FirePath) —
// baseStats (Stats) thêm field BẮT BUỘC MỚI `projectileSpeedPercent`
// (Tật Hỏa minor, xem core/combat/missile/MissileSystem.ts's fire()).
// Save cũ thiếu field này — không viết migration, cùng convention mọi
// version trước.
// version 31 (2026-08-21): Hỏa Trúc Cơ hoàn thiện (Plans/FirePath mục
// 5-9) — baseStats (Stats) thêm 4 field BẮT BUỘC MỚI
// `elementApplicationPercent`/`reactionEffectPercent`/
// `hoaTheGainPerCast`/`hoaTheDecayReductionPercent` (Dẫn Hỏa/Hỏa
// Nguyên/Cộng Minh/Tụ Hỏa/Hỏa Mạch/Tụ Viêm, xem data/progression/
// PhapTuNodes.ts). Save cũ thiếu các field này — không viết migration,
// cùng convention mọi version trước.
// version 32 (2026-08-21): Thủy waterpath hoàn thiện (Plans/waterpath)
// — baseStats (Stats) thêm 2 field BẮT BUỘC MỚI `thuyThePercent`/
// `waterReactionExtensionSeconds` (Tụ Thủy/Thủy Mạch/Nhu Lưu/Dẫn Lưu,
// xem data/progression/PhapTuNodes.ts). Save cũ thiếu các field này —
// không viết migration, cùng convention mọi version trước.
// version 33 (2026-08-21): Mộc PoisonPath hoàn thiện (Plans/PoisonPath)
// — baseStats (Stats) thêm 4 field BẮT BUỘC MỚI `ailmentDurationPercent`/
// `poisonRootPercentPerStack`/`poisonRootMaxStacks`/
// `poisonRootThresholdBonusPercent` (Độc Tức/Độc Trường/Độc Căn/Độc
// Uyên/Độc Mạch, xem data/progression/PhapTuNodes.ts). Save cũ thiếu
// các field này — không viết migration, cùng convention mọi version
// trước.
// version 34 (2026-08-21): Thổ EarthPath hoàn thiện (Plans/EarthPath) —
// baseStats (Stats) thêm 5 field BẮT BUỘC MỚI `earthAoeRadius`/
// `earthAoeSecondaryDamagePercent`/`earthKnockbackDistance`/
// `skillImpactPercent`/`thoTheGainPerCast` (Thổ Thế/Chấn Lực/Chấn Vực/
// Trọng Thổ, xem data/progression/PhapTuNodes.ts). Save cũ thiếu các
// field này — không viết migration, cùng convention mọi version trước.
// version 35 (2026-08-21): Kim KimPath hoàn thiện (Plans/KimPath) —
// baseStats (Stats) thêm 5 field BẮT BUỘC MỚI `kimTheGainPerProc`/
// `kimTheDotDamagePercentPerStack`/
// `kimTheDotResistancePenetrationPercentPerStack`/`kimTheMaxStacksBonus`/
// `metalAilmentPotencyPercent` (Kim Thế/Kim Uyên/Huyết Ấn/Huyết Lưu,
// xem data/progression/PhapTuNodes.ts). Đây cũng là hành CUỐI CÙNG
// trong Ngũ Hành hoàn tất redesign (Hỏa/Thủy/Mộc/Thổ/Kim). Save cũ
// thiếu các field này — không viết migration, cùng convention mọi
// version trước.
// version 36 (2026-08-21): Plans/magicpathgeneral — Reaction Engine
// transaction refactor + DOT RES + Poison Recovery. baseStats (Stats)
// thêm 2 field BẮT BUỘC MỚI `dotResistancePercent`/
// `poisonRecoveryPercent` (xem core/combat/CombatSystem.ts's
// applyDotDamage(), core/stats/StatTypes.ts). CŨNG đổi tên hiển
// thị "Độc Căn" <-> "Mộc Thế" cho đúng semantic (KHÔNG đổi field/id
// nào — save cũ tương thích với riêng phần này). Save cũ thiếu 2 field
// Stats mới — không viết migration, cùng convention mọi version trước.
// version 37 (2026-08-21): Plans/magicpathgeneral Phase 13 — Huyết
// Phá (Kim Tu). baseStats (Stats) thêm 2 field BẮT BUỘC MỚI
// `huyetPhaGainPerProc`/`huyetPhaBurstDamage` (node "Huyết Phá", xem
// data/progression/PhapTuNodes.ts). `CombatEntity.currentHuyetPha` là
// optional/runtime-only, KHÔNG persist (không cần bump vì lý do này).
// Save cũ thiếu 2 field Stats mới — không viết migration, cùng
// convention mọi version trước.
// version 38: progression/combat rework. No migration: development saves
// from earlier schemas are intentionally rejected.
const CURRENT_SAVE_VERSION = 38 as const

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
// version 3: thêm formations (FormationBag) — socketedFormation
// trên equipment instance tự động đi theo `equipment` sẵn có,
// không cần field riêng.
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
// PlayerData thêm totalMonstersKilled/unlockedRealmEnhancements. Save
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
// EquipmentInstance trong save không còn 3 field enhanceLevel/
// socketedFormation/bonusSubstatSlots. Save cũ (version <8) KHÔNG
// tương thích, không viết migration — cùng lý do các version trước.
// version 9: Core Loop Foundation checklist (Mục AFFIX/RARITY) —
// EquipmentInstance đổi `substats: StatModifier[]` thành
// `affixes: RolledAffix[]` (xem core/equipment/RolledAffix.ts) + thêm
// field `rarity: EquipmentRarity` (xem core/equipment/EquipmentRarity.ts).
// EquipmentSlotState đổi tên `bonusSubstatSlots` -> `bonusAffixSlots`
// (cùng ý nghĩa).
// version 10: Đột Phá Trúc Cơ (Phase 1) — xoá PlayerData.pillUsageCount
// + Pill.usageLimit, thay bằng trần theo cảnh giới (RealmData.attributeCap,
// xem PillSystem.canUse()).
// version 11: Đột Phá Trúc Cơ (Phase 5) — thêm
// PlayerData.highestFoundationAchieved (mục 16 spec `breakthrough`).
// version 12: Home Hub (Phase 2) — thêm EquipmentSlotState.appliedTalismanIds
// (badge Phù Viện, xem GameManager.applyTalisman()).
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
// version 16: Thám Hiểm rework — player: PlayerData thêm
// isCultivating (cổng thủ công tu luyện, xem stores/player.ts's
// toggleCultivating()). Save cũ (version <16) KHÔNG tương thích,
// không viết migration — cùng lý do các version trước.
// version 17: Naming-principles pass ("nguyen li dat ten") —
// equipment: EquipmentInstance[]'s `rarity` đổi hẳn value set — 5 bậc
// Ngũ Phẩm mới (hoang_pham/huyen_pham/dia_pham/thien_pham/tien_pham,
// xem core/item/Pham.ts) thay 4 bậc "Duyên" cũ (vo_duyen/tieu_duyen/
// ky_duyen/thien_duyen). Pill/Talisman/Formation template (đăng ký lúc
// bootstrap, không nằm trong save) đổi `grade: number` -> `pham: Pham`
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
// `totalCultivationGained: number` (Kiếm Ý vĩnh viễn, xem core/player/
// SwordIntentSystem.ts). Save cũ thiếu field này — không viết
// migration, cùng convention mọi version trước.
export interface GameSave {
  version: typeof CURRENT_SAVE_VERSION

  player: PlayerData

  techniques: Technique[]

  skills: Skill[]

  materials: MaterialStackSave[]

  equipment: EquipmentInstance[]

  pills: PillStackSave[]

  talismans: TalismanStackSave[]

  formations: FormationStackSave[]

  explorations: ActiveExploration[]

  crafts: ActiveCraft[]

  buildings: BuildingInstance[]

  equipmentSlots: EquipmentSlotState[]
}

export function saveGame(player: PlayerData, gameManager: GameManager) {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,

    player: {
      ...player,

      lastSavedAt: Date.now(),
    },

    techniques: gameManager.techniqueManager.getAll(),

    skills: gameManager.skillManager.getAll(),

    materials: gameManager.materialBag.getAll().map(stack => ({
      materialId: stack.material.id,

      amount: stack.amount,
    })),

    equipment: gameManager.equipmentBag.getAll(),

    pills: gameManager.pillBag.getAll().map(stack => ({
      pillId: stack.pill.id,

      amount: stack.amount,
    })),

    talismans: gameManager.talismanBag.getAll().map(stack => ({
      talismanId: stack.talisman.id,

      amount: stack.amount,
    })),

    formations: gameManager.formationBag.getAll().map(stack => ({
      formationId: stack.formation.id,

      amount: stack.amount,
    })),

    explorations: gameManager.explorationManager.getAll(),

    crafts: gameManager.craftingManager.getAll(),

    buildings: gameManager.buildingManager.getAll(),

    equipmentSlots: gameManager.equipmentSlotManager.getAll(),
  }

  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

// Phase 5 (Reliability, mục XVI) — trước đây version không khớp hoặc
// JSON hỏng đều trả về null giống hệt "chưa từng có save", khiến
// App.vue coi là nhân vật mới và ÂM THẦM ghi đè save cũ ở lần save()
// kế tiếp. Giờ phân biệt rõ 3 trường hợp để App.vue chặn boot, báo
// người chơi, và để họ tự quyết (Export/Xoá) thay vì mất trắng không
// biết vì sao — xem SaveIncompatibleScreen.vue.
export type LoadOutcome =
  | { status: 'empty' }
  | { status: 'ok'; save: GameSave }
  | { status: 'incompatible'; foundVersion: number | undefined; raw: string }
  | { status: 'corrupted'; raw: string }

export function loadGame(): LoadOutcome {
  const raw = localStorage.getItem(SAVE_KEY)

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

  if (typeof foundVersion !== 'number' || foundVersion !== CURRENT_SAVE_VERSION) {
    return {
      status: 'incompatible',
      foundVersion: typeof foundVersion === 'number' ? foundVersion : undefined,
      raw,
    }
  }

  return { status: 'ok', save: parsed as GameSave }
}

// Sao lưu save hiện có vào BACKUP_KEY — gọi TRƯỚC mọi thao tác có
// thể xoá/ghi đè save chính (deleteSave(), importSaveRaw()), để luôn
// còn 1 bước lùi qua restoreBackup() nếu người chơi bấm nhầm.
export function backupCurrentSave() {
  const raw = localStorage.getItem(SAVE_KEY)

  if (raw) {
    localStorage.setItem(BACKUP_KEY, raw)
  }
}

export function hasBackup(): boolean {
  return localStorage.getItem(BACKUP_KEY) !== null
}

export function getRawSave(): string | null {
  return localStorage.getItem(SAVE_KEY)
}

export function restoreBackup(): boolean {
  const raw = localStorage.getItem(BACKUP_KEY)

  if (!raw) {
    return false
  }

  localStorage.setItem(SAVE_KEY, raw)

  return true
}

export function deleteSave() {
  backupCurrentSave()

  localStorage.removeItem(SAVE_KEY)
}

// Tải save hiện có (bất kể đọc được hay không) xuống file .json —
// đường thoát an toàn thật sự cho save không tương thích/hỏng, vì
// BACKUP_KEY vẫn nằm trong cùng localStorage nên mất theo nếu người
// dùng xoá site data.
export function exportSaveToFile(raw: string) {
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')

  link.href = url
  link.download = `tien-hiep-idle-save-${Date.now()}.json`
  link.click()

  URL.revokeObjectURL(url)
}

// Nhập save từ nội dung file .json do người chơi chọn — chỉ kiểm tra
// tối thiểu (parse được + có field `version`/`player`) rồi ghi thẳng
// vào SAVE_KEY; loadGame() ở lần reload kế tiếp sẽ tự đánh giá lại
// tương thích version như mọi save khác. Backup save hiện tại (nếu
// có) trước khi ghi đè.
export function importSaveRaw(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw)

    if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || !('player' in parsed)) {
      return false
    }
  } catch {
    return false
  }

  backupCurrentSave()

  localStorage.setItem(SAVE_KEY, raw)

  return true
}
