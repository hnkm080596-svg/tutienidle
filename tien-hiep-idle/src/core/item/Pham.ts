/**
 * Naming-principles pass (2026-08-14, xem file "nguyen li dat ten" ở
 * gốc project) — thang 5 bậc dùng CHUNG cho Equipment (thay
 * EquipmentRarity "Duyên" cũ) VÀ Pill/Talisman/Formation (thay `grade`
 * phẳng cũ). 1 nguồn duy nhất tránh 4 nơi tự định nghĩa lại cùng 5
 * label. Ý nghĩa MECHANIC khác nhau theo từng hệ (Equipment: số lượng
 * Affix, xem EquipmentRarity.ts; Pill/Talisman/Formation: độ mạnh
 * effect trực tiếp, không roll/instance) — nhưng TÊN và THỨ TỰ luôn
 * thống nhất, đúng tinh thần tài liệu "đan/khí trận phù đều theo tới
 * late game theo phẩm".
 */
import type { NameSegment } from './NameSegment'

export type Pham = 'hoang_pham' | 'huyen_pham' | 'dia_pham' | 'thien_pham' | 'tien_pham'

// Thứ tự thấp -> cao.
export const PHAM_ORDER: Pham[] = ['hoang_pham', 'huyen_pham', 'dia_pham', 'thien_pham', 'tien_pham']

export const PHAM_LABELS: Record<Pham, string> = {
  hoang_pham: 'Hoàng Phẩm',
  huyen_pham: 'Huyền Phẩm',
  dia_pham: 'Địa Phẩm',
  thien_pham: 'Thiên Phẩm',
  tien_pham: 'Tiên Phẩm',
}

// Tên vật phẩm ghép động (2026-08-15) — Pill/Talisman/Formation chỉ có
// 1 trục Phẩm (khác Equipment có thêm Set/Địa Giới, xem
// core/equipment/EquipmentNaming.ts): [Phẩm, tô màu theo tier] · [tên
// gốc, màu mặc định]. `name` truyền vào PHẢI là tên gốc KHÔNG chứa
// tiền tố Phẩm (xem data/pill/pills.ts và tương đương — tiền tố cũ đã
// bóc khỏi `name`, giữ lại đúng trong field `pham` này).
export function composePhamNameSegments(name: string, pham: Pham): NameSegment[] {
  return [
    { text: PHAM_LABELS[pham], colorVar: `--item-rarity-${pham}` },
    { text: name },
  ]
}
