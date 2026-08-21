import type { EquipmentSlot } from './EquipmentTypes'
import type { StatType } from '../stats/StatTypes'
import type { RecipeMaterialCost } from '../recipe/Recipe'

// MASTER SPEC Mục VI (Phase 6, hợp nhất framework COST) — Luyện Khí
// (Cường Hóa/Tẩy Luyện/Tinh Luyện/Nâng Phẩm/Nâng Cảnh Giới) dùng
// CHUNG shape chi phí nguyên liệu với Recipe (Đan/Phù/Trận) thay vì
// tự định nghĩa lại {materialId,amount} riêng — Khí vẫn KHÔNG dùng
// Recipe/CraftingSystem thật (giữ nguyên hành vi INSTANT, không có
// craftDuration/hàng chờ) vì đây là thao tác tức thời quen thuộc với
// người chơi, chỉ hợp nhất phần TYPE của chi phí, không hợp nhất luồng
// thực thi.
export type EquipmentEnhanceCost = RecipeMaterialCost

export interface EquipmentStatRange {
  stat: StatType

  min: number

  max: number
}

export interface Equipment {
  id: string

  // Tên GỐC, KHÔNG chứa tiền tố Phẩm/Set/Địa Giới (2026-08-15, cơ chế
  // Set + tên ghép động) — vd "Trảm Không Kiếm", không phải "Thái Hư
  // Trảm Không Kiếm". Tên đầy đủ hiển thị ghép động lúc runtime, xem
  // EquipmentNaming.ts's composeEquipmentNameSegments().
  name: string

  description?: string

  // Path ảnh minh hoạ — khai NGAY TRÊN data item (2026-08-15), xem
  // ghi chú tương tự trong core/technique/Technique.ts.
  icon?: string

  slot: EquipmentSlot

  // Cơ chế Set (2026-08-15) — liên kết tới EquipmentSet (xem
  // EquipmentSet.ts), không khai = item KHÔNG thuộc Set nào (đa số
  // item hiện có). 6 item CÙNG setId đại diện đủ 6 EquipmentSlot của 1
  // Set — không enforce cứng ở type, chỉ đúng theo quy ước data.
  setId?: string

  grade: number

  maxEnhanceLevel: number

  // Cảnh giới tối thiểu để TRANG BỊ món này (Level requirement, checklist
  // Equipment Base) — không set = mở ngay từ đầu, dùng lại đúng
  // convention getRealmIndex() đã dùng ở Recipe/Building.
  requiredRealmId?: string

  // Implicit — chỉ số CHẮC CHẮN có trên mọi instance của template này
  // (roll 1 giá trị trong range rồi scale thêm theo cảnh giới người
  // chơi lúc rớt, xem EquipmentSystem.createInstance()), tách biệt
  // hoàn toàn khỏi Affix pool (Prefix/Suffix, xem Affix.ts) — Implicit
  // không tính vào giới hạn số Affix theo Rarity.
  mainStat: EquipmentStatRange

  enhanceCost?: EquipmentEnhanceCost[]

  // "tunghematandsuch" pass (2026-08-14) — Cường Hóa giờ CŨNG tốn
  // Linh Thạch (player.spiritStone), cùng pattern
  // upgradeRealmSpiritStoneCost bên dưới, xem EquipmentSystem.enhance().
  enhanceSpiritStoneCost?: number

  washCost?: EquipmentEnhanceCost[]

  // Tinh Luyện (Equipment Rework) — reroll giá trị Implicit (mainStat),
  // KHÔNG còn tăng level/scale (đã chuyển sang forgeCost/forgePoints
  // bên dưới) — thao tác lặp lại vô hạn, giống washCost.
  refineCost?: EquipmentEnhanceCost[]

  // Rèn (Equipment Rework) — hệ thống đầu tư sức mạnh CHÍNH của item,
  // thay thế vai trò cũ của refineLevel. Chi phí scale theo forgePoints
  // hiện tại (xem EquipmentSystem.forge()), trần theo Quality
  // (EQUIPMENT_QUALITY_MAX_FORGE_POINTS).
  forgeCost?: EquipmentEnhanceCost[]

  upgradeQualityCost?: EquipmentEnhanceCost[]

  upgradeRealmCost?: EquipmentEnhanceCost[]

  upgradeRealmSpiritStoneCost?: number

  addAffixCost?: EquipmentEnhanceCost[]

  upgradeAffixCost?: EquipmentEnhanceCost[]
}
