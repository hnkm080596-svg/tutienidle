import type { Exploration } from '@/core/exploration/Exploration'

import type {
  ExplorationMaterialReward,
} from '@/core/exploration/ExplorationReward'


export interface ExplorationData {
  exploration: Exploration

  rewards: ExplorationMaterialReward[]
}


// Thanh Vân naming pass (2026-08-15) — 3 vùng khai thác đổi tên theo
// địa giới "Thanh Vân" (xem data/stage/Zones.ts): Sơn (linh thảo,
// KHÔNG đổi — đã đúng sẵn), Lâm (linh mộc, "Mộc Lâm" -> "Thanh Vân
// Lâm"), Khoáng (linh khoáng, "Huyền Thiết Quật" -> "Thanh Vân
// Khoáng"). id/region/rewards GIỮ NGUYÊN, chỉ đổi `name`.
export const explorations: ExplorationData[] = [
  {
    exploration: {
      id: 'thanh-van-mountain',

      name: 'Thanh Vân Sơn',

      description:
        'Một vùng núi giàu linh thảo, thích hợp cho tu sĩ sơ kỳ.',

      duration:
        30 * 60,

      maxRuns: 10,

      enabled: true,

      region: 'spirit_mountain',
    },

    // Khai Thác/Linh Thảo Viên rework (2026-08-15) — vùng này trước
    // rơi thẳng green-spirit-herb/fire-spirit-herb, trùng chức năng
    // với Linh Thảo Viên (building tự sinh cùng material). Giờ chỉ
    // nhặt hạt giống thô — đem về gieo ở Linh Thảo Viên mới ra linh
    // thảo thật (xem data/building/buildings.ts's herb_garden). Cả 2
    // herb material cũ vẫn còn nguồn khác (Quế/fire-spirit-herb rơi từ
    // quái, xem data/enemy/Enemies.ts) nên không mất hẳn đường ra.
    rewards: [
      {
        materialId:
          'linh_thao_chung',

        minAmount: 3,

        maxAmount: 6,

        chance: 1,

        tier: 'common',
      },

      // Đột Phá Trúc Cơ (Phase 6) — loot vô thưởng vô phạt (mục 14
      // spec `breakthrough`), chance thấp cố ý.
      {
        materialId: 'broken_foundation_scroll',
        minAmount: 1,
        maxAmount: 1,
        chance: 0.08,
        tier: 'rare',
      },

      {
        materialId: 'old_jade_slip',
        minAmount: 1,
        maxAmount: 1,
        chance: 0.08,
        tier: 'rare',
      },
    ],
  },

  {
    exploration: {
      id: 'black-iron-cave',

      name: 'Thanh Vân Khoáng',

      description:
        'Một mỏ quặng nằm sâu dưới lòng đất.',

      duration:
        2 * 60 * 60,

      maxRuns: 10,

      enabled: true,

      region: 'iron_cave',
    },

    // Khai Thác/Thiết Khoáng Sơn rework (2026-08-15) — vùng này trước
    // rơi thẳng black-iron (thành phẩm CỦA Lò Luyện, trùng chức năng
    // hẳn với chuỗi Building), giờ chỉ nhặt quặng thô — phải đem về Lò
    // Luyện mới ra Huyền Thiết (xem data/building/processingRecipes.ts).
    // red-copper vẫn còn nguồn khác (rơi từ quái, xem data/enemy/Enemies.ts).
    rewards: [
      {
        materialId:
          'quang_sat',

        minAmount: 5,

        maxAmount: 10,

        chance: 1,

        tier: 'common',
      },
    ],
  },

  // Thiên Công Phường rework (2026-08-15) — vùng thứ 3, hoàn thiện bộ 3
  // nguyên liệu thô song song với Thanh Vân Sơn (hạt giống)/Huyền Thiết
  // Quật (quặng thô): Mộc Lâm nhặt Linh Mộc thô, đem về Thiên Công
  // Phường mới ra Phù Chỉ dùng chế Phù (xem data/building/buildings.ts).
  {
    exploration: {
      id: 'wood-spirit-forest',

      name: 'Thanh Vân Lâm',

      description:
        'Khu rừng linh mộc cổ thụ, gỗ mang linh khí Mộc thuần khiết.',

      duration:
        60 * 60,

      maxRuns: 10,

      enabled: true,

      region: 'wood_forest',
    },

    rewards: [
      {
        materialId:
          'thanh_linh_moc',

        minAmount: 3,

        maxAmount: 6,

        chance: 1,

        tier: 'common',
      },
    ],
  },
]
