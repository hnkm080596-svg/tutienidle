import type { PillType } from './PillTypes'
import type { PillEffect } from './PillEffect'
import type { ItemGrade } from '../item/ItemGrade'
import type { ProfessionGrade } from '../profession/ProfessionGrade'

export interface Pill {
  id: string

  name: string

  description?: string

  // Path ảnh minh hoạ — khai NGAY TRÊN data item (2026-08-15), xem
  // ghi chú tương tự trong core/technique/Technique.ts.
  icon?: string

  type: PillType

  // Naming-principles pass (2026-08-14) — thay `grade: number` cũ,
  // dùng CHUNG thang Ngũ Phẩm với Equipment/Talisman/Formation (xem
  // core/item/Pham.ts) — Phẩm ở đây là driver THẬT (không phải nhãn
  // suy ra), quyết định trực tiếp độ mạnh effect. Tên ghép động
  // (2026-08-15) — `name` bên trên KHÔNG chứa tiền tố Phẩm, ghép động
  // lúc hiển thị từ field này (xem composeItemGradeNameSegments()).
  grade: ItemGrade

  // Nghề Đan mới (2026-08-24, resource-professions-rework §5.1): realm
  // + phẩm nghề theo cảnh giới. Pill CÓ realmId bị gate ĐÚNG cảnh giới
  // khi dùng (wrong_realm — plan §5.2); legacy pill không có field này
  // giữ hành vi cũ.
  realmId?: string

  professionGrade?: ProfessionGrade

  effects: PillEffect[]
}
