import type { StatModifier } from '../stats/StatCalculator'
import type { CultivationPathId } from '../player/CultivationPathKit'

// Cơ chế Set (2026-08-15) — mỗi 1 trong 6 Pháp Tu (Ngũ Hành + Kiếm Tu,
// xem CultivationPathKit.ts) sở hữu 1 Set trang bị 6 món (khớp 6
// EquipmentSlot), mang tên 1 vị thần trong thần thoại Trung Hoa. Buff
// cộng dồn theo mốc số món ĐANG TRANG BỊ, xem
// EquipmentSystem.getActiveSetModifiers().
export interface EquipmentSetBonus {
  pieces: 2 | 4 | 6

  modifiers: StatModifier[]
}

export interface EquipmentSet {
  id: string

  // Tên vị thần, vd "Thái Hư" — hiển thị làm segment riêng trong tên
  // vật phẩm (xem EquipmentNaming.ts), tô màu theo `colorVar`.
  name: string

  pathId: CultivationPathId

  // Tên biến CSS custom property cố định cho Set này (vd '--set-thai_hu',
  // khai trong assets/theme.css) — KHÔNG phải giá trị màu.
  colorVar: string

  // LUÔN đủ 3 phần tử (mốc 2/4/6 món) — Set "khung" (chưa có vật phẩm
  // thật tham chiếu setId) vẫn khai đủ 3 mốc, chỉ để `modifiers: []`.
  bonuses: EquipmentSetBonus[]
}
