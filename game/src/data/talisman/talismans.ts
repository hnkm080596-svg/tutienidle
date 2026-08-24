import type { Talisman } from '@/core/talisman/Talisman'

// Naming-principles pass (2026-08-14) — [Effect] + Phù, `pham` thay
// `grade` cũ (xem Pham.ts). Tên ghép động (2026-08-15) — tiền tố Phẩm
// KHÔNG còn bake vào `name`, ghép động lúc hiển thị từ `pham` (xem
// core/item/Pham.ts's composeItemGradeNameSegments(), TalismanBagSection.vue).
export const talismans: Talisman[] = [
  {
    id: 'slot_expansion_talisman',

    name: 'Khai Huyệt Phù',

    icon: '/assets/talismans/slot_expansion_talisman.png',

    // MASTER SPEC Mục VI (Phase 8) — đổi từ 1 lên 2 dòng chỉ số phụ
    // mỗi lần áp dụng, đúng "mở thêm 2 dòng chỉ số".
    description: 'Phù chú khai mở thêm huyệt vị trên trang bị, tạo thêm 2 dòng chỉ số phụ.',

    grade: 'huyen',

    extraSubstatSlots: 2,
  },
]
