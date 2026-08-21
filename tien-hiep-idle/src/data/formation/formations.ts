import type { Formation } from '@/core/formation/Formation'

// Naming-principles pass (2026-08-14) — [Effect] + Trận, `pham` thay
// `grade` cũ (xem Pham.ts). Effect word của blazing_strike_formation
// đổi "Liệt Diễm" -> "Liệt Hỏa" để khớp đúng chính tả Effect Dictionary
// trong tài liệu (mục 12, nhóm Offensive). Tên ghép động (2026-08-15)
// — tiền tố Phẩm KHÔNG còn bake vào `name`, ghép động lúc hiển thị từ
// `pham` (xem core/item/Pham.ts's composePhamNameSegments(),
// FormationBagSection.vue).
export const formations: Formation[] = [
  {
    id: 'blazing_strike_formation',

    name: 'Liệt Hỏa Trận',

    icon: '/assets/formations/blazing_strike_formation.png',

    description: 'Trận pháp khảm vào vũ khí, mỗi đòn đánh trúng tích luỹ thêm sát khí.',

    pham: 'huyen_pham',

    trigger: 'hit',

    modifiers: [
      {
        id: 'blazing_strike_formation_attack',

        sourceId: 'blazing_strike_formation',
        sourceType: 'formation',

        stat: 'attack',

        percent: 0.005,

        stacks: 0,

        maxStacks: 50,
      },
    ],
  },

  // MASTER SPEC Mục VI (Phase 8) — minh hoạ Defensive Formation với
  // trigger khác 'hit' (per_second, giống buff tích luỹ theo thời
  // gian đứng chiến đấu, không phụ thuộc số đòn đánh ra).
  {
    id: 'golden_bell_formation',

    name: 'Kim Chung Trận',

    icon: '/assets/formations/golden_bell_formation.png',

    description: 'Trận pháp phòng ngự, mỗi giây chiến đấu tích luỹ thêm hộ thể chân khí.',

    pham: 'huyen_pham',

    trigger: 'per_second',

    modifiers: [
      {
        id: 'golden_bell_formation_defense',

        sourceId: 'golden_bell_formation',
        sourceType: 'formation',

        stat: 'defense',

        percent: 0.004,

        stacks: 0,

        maxStacks: 60,
      },
    ],
  },

  // Utility Formation — trigger 'critical', cấp leech thay vì buff
  // thuần công/thủ.
  {
    id: 'lifesteal_formation',

    name: 'Đoạt Mệnh Trận',

    icon: '/assets/formations/lifesteal_formation.png',

    description: 'Trận pháp tà môn, mỗi đòn chí mạng hút thêm sinh lực từ kẻ địch.',

    pham: 'dia_pham',

    trigger: 'critical',

    modifiers: [
      {
        id: 'lifesteal_formation_leech',

        sourceId: 'lifesteal_formation',
        sourceType: 'formation',

        stat: 'leechPercent',

        percent: 0.01,

        stacks: 0,

        maxStacks: 20,
      },
    ],
  },
]
