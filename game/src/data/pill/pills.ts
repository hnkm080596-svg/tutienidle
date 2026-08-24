import type { Pill } from '@/core/pill/Pill'

// Naming-principles pass (2026-08-14, xem file "nguyen li dat ten" ở
// gốc project) — TÊN mọi pill đổi sang [Effect] + Đan (doc mục 8-9:
// "Phẩm không phải rarity, nó trực tiếp biểu thị độ mạnh/cấp độ thành
// phẩm"; "Tên phải nói thẳng: Uống cái này để làm gì?"). `pham`
// (core/item/Pham.ts) thay hẳn `grade: number` cũ — cùng thang 5 bậc
// Hoàng/Huyền/Địa/Thiên/Tiên với Equipment Rarity/Talisman/Formation.
// Vài pill trước đây đặt tên theo LOÀI quái chế ra nó (Viêm Hồ Đan/
// Nham Hùng Đan/Đoạn Nhận Đan/Giao Xà Đan) — VI PHẠM quy tắc trên (tên
// lore, không nói công dụng) — đã đổi sang tên theo EFFECT + gộp vào
// đúng "họ hiệu ứng" cùng những pill khác cùng công dụng (VD Hồi
// Nguyên: Hoàng Phẩm 50 HP -> Huyền Phẩm 150 HP). 3 pill "Trúc Cơ Đan/
// Tôi Thể Đan/Rèn Linh Đan" là bộ đếm ẩn Đột Phá Trúc Cơ (khớp theo ID,
// xem core/breakthrough/FoundationResolver.ts) — description/effects
// giữ NGUYÊN 100%.
//
// Tên ghép động (2026-08-15) — tiền tố Phẩm KHÔNG còn bake vào `name`
// (trước là "Hoàng Phẩm Hồi Nguyên Đan"), giờ ghép động lúc hiển thị
// TỪ field `pham` bên dưới (xem core/item/Pham.ts's
// composeItemGradeNameSegments(), PillBagSection.vue) — `name` ở đây chỉ
// còn phần [Effect] + Đan.
export const pills: Pill[] = [
  {
    id: 'minor_healing_pill',

    name: 'Hồi Nguyên Đan',

    icon: '/assets/pills/minor_healing_pill.png',

    description: 'Đan dược phổ thông, hồi phục một ít khí huyết.',

    type: 'healing',

    grade: 'hoang',

    effects: [
      {
        type: 'heal',

        value: 50,
      },
    ],
  },

  {
    id: 'qi_gathering_pill',

    name: 'Tụ Khí Đan',

    icon: '/assets/pills/qi_gathering_pill.png',

    description: 'Giúp tăng tốc quá trình tu luyện trong chốc lát.',

    type: 'cultivation',

    grade: 'huyen',

    effects: [
      {
        type: 'cultivation',

        value: 100,
      },
    ],
  },

  {
    id: 'body_forging_pill',

    name: 'Cường Công Đan',

    icon: '/assets/pills/body_forging_pill.png',

    description: 'Đan dược quý hiếm, tăng vĩnh viễn công kích.',

    type: 'permanent',

    grade: 'dia',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'attack',

        value: 2,
      },
    ],
  },

  {
    id: 'body_tempering_pill',

    name: 'Cố Thể Đan',

    icon: '/assets/pills/body_tempering_pill.png',

    description: 'Luyện từ da/nanh yêu thú và quặng sắt, tăng vĩnh viễn khí huyết tối đa.',

    type: 'permanent',

    grade: 'huyen',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'maxHp',

        value: 20,
      },
    ],
  },

  {
    id: 'spirit_condensing_pill',

    name: 'Ngưng Thần Đan',

    icon: '/assets/pills/spirit_condensing_pill.png',

    description: 'Đan dược cao cấp luyện từ Tinh Hoa Hỏa của yêu thú thủ lĩnh, tăng vĩnh viễn linh lực tối đa.',

    type: 'permanent',

    grade: 'dia',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'maxMp',

        value: 20,
      },
    ],
  },

  // Đột Phá Trúc Cơ (Phase 3) — nguyên liệu đếm ẩn cho Đại Đạo (mục 8
  // spec `breakthrough`, xem core/breakthrough/FoundationResolver.ts).
  // Về mặt cơ chế KHÔNG có gì đặc biệt — pill permanent_stat bình
  // thường, vẫn chịu trần cảnh giới (PillSystem.canUse()) như mọi pill
  // khác, cố ý không lộ vai trò ẩn qua description.
  {
    id: 'foundation_pill',

    name: 'Trúc Cơ Đan',

    icon: '/assets/pills/foundation_pill.png',

    description: 'Đan dược cổ phương, tăng vĩnh viễn khí huyết tối đa.',

    type: 'permanent',

    grade: 'dia',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'maxHp',

        value: 1,
      },
    ],
  },

  {
    id: 'body_refining_pill',

    name: 'Tôi Thể Đan',

    icon: '/assets/pills/body_refining_pill.png',

    description: 'Đan dược tôi luyện thân thể, tăng vĩnh viễn phòng ngự.',

    type: 'permanent',

    grade: 'dia',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'defense',

        value: 1,
      },
    ],
  },

  {
    id: 'spirit_forging_pill',

    name: 'Rèn Linh Đan',

    icon: '/assets/pills/spirit_forging_pill.png',

    description: 'Đan dược rèn luyện linh khí, tăng vĩnh viễn linh lực tối đa.',

    type: 'permanent',

    grade: 'dia',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'maxMp',

        value: 1,
      },
    ],
  },

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — 5 pill MỚI, tiêu
  // thụ nguyên liệu từ 4 Element mới (Hỏa/Thổ/Kim/Thủy, xem
  // data/materials/materials.ts) + 1 pill hồi máu bậc trung (chỉ có
  // Hồi Nguyên Đan bậc Hoàng trước đây, không đủ cho player HP đã tăng
  // qua tầng 2-10). Mỗi pill essence-based đều permanent_stat khác
  // nhau, tránh trùng lặp công dụng.
  {
    id: 'medium_healing_pill',

    name: 'Hồi Nguyên Đan',

    icon: '/assets/pills/medium_healing_pill.png',

    description: 'Đan dược hồi phục khí huyết bậc trung, luyện từ khoáng nham thạch.',

    type: 'healing',

    grade: 'huyen',

    effects: [
      {
        type: 'heal',

        value: 150,
      },
    ],
  },

  // Naming-principles pass — trước đây "Viêm Hồ Đan" (đặt theo loài
  // quái, vi phạm quy tắc §9). Cùng họ Cường Công với body_forging_pill
  // (Địa Phẩm, atk+2) — đây là bậc kế tiếp (Thiên Phẩm, atk+3).
  {
    id: 'flame_fox_pill',

    name: 'Cường Công Đan',

    icon: '/assets/pills/flame_fox_pill.png',

    description: 'Đan dược luyện từ lông Viêm Hồ và Tinh Hoa dung nham, tăng vĩnh viễn công kích.',

    type: 'permanent',

    grade: 'thien',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'attack',

        value: 3,
      },
    ],
  },

  // Naming-principles pass — trước đây "Nham Hùng Đan" (loài quái).
  {
    id: 'rock_bear_pill',

    name: 'Cường Thủ Đan',

    icon: '/assets/pills/rock_bear_pill.png',

    description: 'Đan dược luyện từ da Nham Hùng và Tinh Hoa Thổ, tăng vĩnh viễn phòng ngự.',

    type: 'permanent',

    grade: 'thien',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'defense',

        value: 3,
      },
    ],
  },

  // Naming-principles pass — trước đây "Đoạn Nhận Đan" (loài quái).
  {
    id: 'blade_hawk_pill',

    name: 'Nhuệ Khí Đan',

    icon: '/assets/pills/blade_hawk_pill.png',

    description: 'Đan dược luyện từ vuốt Đoạn Nhận Ưng và giáp Kim Giáp Trùng, tăng vĩnh viễn tỉ lệ bạo kích.',

    type: 'permanent',

    grade: 'dia',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'criticalRate',

        value: 0.01,
      },
    ],
  },

  // Naming-principles pass — trước đây "Giao Xà Đan" (loài quái). Cùng
  // họ Cố Thể với body_tempering_pill (Huyền Phẩm, maxHp+20) — đây là
  // bậc CAO NHẤT (Tiên Phẩm, capstone tầng 10) nên value được nâng
  // 5 -> 30 (bản cũ 5 < 20 của bậc Huyền thấp hơn là SAI thứ tự sức
  // mạnh theo Phẩm — đây là chỉnh số DUY NHẤT trong lượt naming pass
  // này, không phải rebalance ngoài phạm vi).
  {
    id: 'flood_serpent_pill',

    name: 'Cố Thể Đan',

    icon: '/assets/pills/flood_serpent_pill.png',

    description: 'Đan dược quý hiếm luyện từ vảy Giao Xà và Tinh Hoa Thủy Long, tăng vĩnh viễn khí huyết tối đa.',

    type: 'permanent',

    grade: 'tien',

    effects: [
      {
        type: 'permanent_stat',

        stat: 'maxHp',

        value: 30,
      },
    ],
  },

  // Pháp Tu profession-tier ladder (2026-08-14) — pill Hỏa hệ đầu
  // tiên, dùng 'buff' PillEffectType có sẵn (zero plumbing mới) — tăng
  // tạm thời firePower/ailmentPotencyPercent, hợp với build Hỏa Tu.
  {
    id: 'fire_might_pill',

    name: 'Viêm Uy Đan',

    icon: '/assets/pills/fire_might_pill.png',

    description: 'Đan dược luyện từ Quế và Yêu Đan, tăng tạm thời uy lực Hỏa khí.',

    type: 'buff',

    grade: 'dia',

    effects: [
      {
        type: 'buff',

        buff: {
          id: 'fire_might_pill_buff',
          name: 'Viêm Uy',
          category: 'buff',
          duration: 60,
          remainingTime: 60,
          stacks: 1,
          stackMode: 'refresh',
          modifiers: [
            {
              id: 'fire_might_pill_buff_fire_power',
              sourceId: 'fire_might_pill_buff',
              sourceType: 'buff',
              stat: 'firePower',
              flat: 10,
            },
            {
              id: 'fire_might_pill_buff_ailment_potency',
              sourceId: 'fire_might_pill_buff',
              sourceType: 'buff',
              stat: 'ailmentPotencyPercent',
              flat: 0.1,
            },
          ],
        },
      },
    ],
  },

  // Mộc Tu (2026-08-15) — pill Mộc hệ đầu tiên, song hành fire_might_pill
  // nhưng buff leechPercent thay firePower (đúng chủ đề Hấp Huyết).
  {
    id: 'wood_drain_pill',

    name: 'Hấp Huyết Đan',

    icon: '/assets/pills/wood_drain_pill.png',

    description: 'Đan dược luyện từ Thanh Linh Mộc và Yêu Huyết, tăng tạm thời khả năng hút máu.',

    type: 'buff',

    grade: 'dia',

    effects: [
      {
        type: 'buff',

        buff: {
          id: 'wood_drain_pill_buff',
          name: 'Hấp Huyết',
          category: 'buff',
          duration: 60,
          remainingTime: 60,
          stacks: 1,
          stackMode: 'refresh',
          modifiers: [
            {
              id: 'wood_drain_pill_buff_leech',
              sourceId: 'wood_drain_pill_buff',
              sourceType: 'buff',
              stat: 'leechPercent',
              flat: 0.08,
            },
            {
              id: 'wood_drain_pill_buff_ailment_potency',
              sourceId: 'wood_drain_pill_buff',
              sourceType: 'buff',
              stat: 'ailmentPotencyPercent',
              flat: 0.1,
            },
          ],
        },
      },
    ],
  },

  // Thủy/Kim/Thổ Tu (2026-08-15) — 3 pill còn lại của Ngũ Hành, cùng
  // công thức 'buff' + spiritStoneCost đã lập từ fire/wood_..._pill.
  {
    id: 'water_control_pill',

    name: 'Băng Tâm Đan',

    icon: '/assets/pills/water_control_pill.png',

    description: 'Đan dược luyện từ Cúc Hoa và Yêu Đan, tăng tạm thời khả năng giảm hồi chiêu.',

    type: 'buff',

    grade: 'dia',

    effects: [
      {
        type: 'buff',

        buff: {
          id: 'water_control_pill_buff',
          name: 'Băng Tâm',
          category: 'buff',
          duration: 60,
          remainingTime: 60,
          stacks: 1,
          stackMode: 'refresh',
          modifiers: [
            {
              id: 'water_control_pill_buff_cooldown_reduction',
              sourceId: 'water_control_pill_buff',
              sourceType: 'buff',
              stat: 'cooldownReduction',
              flat: 0.08,
            },
            {
              id: 'water_control_pill_buff_water_power',
              sourceId: 'water_control_pill_buff',
              sourceType: 'buff',
              stat: 'waterPower',
              flat: 8,
            },
          ],
        },
      },
    ],
  },

  {
    id: 'metal_bleed_pill',

    name: 'Thiết Sa Đan',

    icon: '/assets/pills/metal_bleed_pill.png',

    description: 'Đan dược luyện từ Huyền Thiết và Yêu Đan, tăng tạm thời uy lực thiết sa.',

    type: 'buff',

    grade: 'dia',

    effects: [
      {
        type: 'buff',

        buff: {
          id: 'metal_bleed_pill_buff',
          name: 'Thiết Sa',
          category: 'buff',
          duration: 60,
          remainingTime: 60,
          stacks: 1,
          stackMode: 'refresh',
          modifiers: [
            {
              id: 'metal_bleed_pill_buff_metal_power',
              sourceId: 'metal_bleed_pill_buff',
              sourceType: 'buff',
              stat: 'metalPower',
              flat: 10,
            },
            {
              id: 'metal_bleed_pill_buff_ailment_potency',
              sourceId: 'metal_bleed_pill_buff',
              sourceType: 'buff',
              stat: 'ailmentPotencyPercent',
              flat: 0.1,
            },
          ],
        },
      },
    ],
  },

  {
    id: 'earth_shield_pill',

    name: 'Bàn Thạch Đan',

    icon: '/assets/pills/earth_shield_pill.png',

    description: 'Đan dược luyện từ Hoàng Kim Linh Thiết và Yêu Đan, tăng tạm thời Hộ Thuẫn tối đa và khả năng phản đòn.',

    type: 'buff',

    grade: 'dia',

    effects: [
      {
        type: 'buff',

        buff: {
          id: 'earth_shield_pill_buff',
          name: 'Bàn Thạch',
          category: 'buff',
          duration: 60,
          remainingTime: 60,
          stacks: 1,
          stackMode: 'refresh',
          modifiers: [
            {
              id: 'earth_shield_pill_buff_ward_max',
              sourceId: 'earth_shield_pill_buff',
              sourceType: 'buff',
              stat: 'wardMax',
              flat: 30,
            },
            {
              id: 'earth_shield_pill_buff_thorns',
              sourceId: 'earth_shield_pill_buff',
              sourceType: 'buff',
              stat: 'thornsPercent',
              flat: 0.08,
            },
          ],
        },
      },
    ],
  },
]
