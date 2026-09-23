import type { TalentDefinition } from '@/core/talent/Talent'

// M-F-TALENT (ruling S15-18) - realm-scoped NEW pools for the mandatory
// breakthrough talent transaction. A victory INTO a realm draws up to 3
// eligible cards from that realm's pool (deduped vs ownership, weighted
// without replacement, bound at settle - no reroll in Beta).
//
// This is a NEW catalog: creation/reward pools (CHARACTER_CREATION_TALENTS,
// GREAT_DAO_REWARD_TALENTS, PARKED_TALENTS) are NOT reused. Every entry
// carries an authored next-level table (`levels`) so the UPGRADE branch
// always has legal targets - creation talents stay maxLevel 1.
//
// Balance is DEFERRED (mission scope): magnitudes are first-pass
// scaffolding on already-consumed effect kinds - no new engine hook.
// The golden_core pool is authored-but-dormant content: ReleasePolicy
// (isBreakthroughAcquisitionEnabled) suppresses it while the realm is
// closed, never by weight or deletion.
export const BREAKTHROUGH_TALENT_POOLS: Readonly<Record<string, TalentDefinition[]>> = {
  // ==================== LUYEN KHI pool (granted at Quan Khi victory) ====================
  qi_refining: [
    {
      id: 'lk_linh_mach',
      name: 'Linh Mạch',
      description: 'Mạch đất dưới chân ngươi còn sót lại chút linh khí. Linh Thạch nhặt được tăng thêm một phần.',
      rarity: 'pham',
      weight: 55,
      tags: ['resource'],
      effects: [{ kind: 'spirit_stone_gain', percent: 0.15 }],
      levels: [
        [{ kind: 'spirit_stone_gain', percent: 0.3 }],
        [{ kind: 'spirit_stone_gain', percent: 0.5 }],
      ],
    },
    {
      id: 'lk_dung_nap',
      name: 'Dung Nạp',
      description: 'Kinh mạch rộng mở, tu vi chảy vào như nước về sông. Tốc độ tu luyện tăng thêm.',
      rarity: 'pham',
      weight: 55,
      tags: ['cultivation'],
      effects: [{ kind: 'cultivation_speed', percent: 0.1 }],
      levels: [
        [{ kind: 'cultivation_speed', percent: 0.2 }],
        [{ kind: 'cultivation_speed', percent: 0.35 }],
      ],
    },
    {
      id: 'lk_tam_tue',
      name: 'Tâm Tuệ',
      description: 'Tâm như gương sáng, chiếu rọi vạn pháp. Cảm Ngộ nhận được từ chiến đấu tăng thêm.',
      rarity: 'linh',
      weight: 28,
      tags: ['resource'],
      effects: [{ kind: 'insight_gain', percent: 0.25 }],
      levels: [
        [{ kind: 'insight_gain', percent: 0.5 }],
        [{ kind: 'insight_gain', percent: 0.8 }],
      ],
    },
    {
      id: 'lk_ngo_tinh',
      name: 'Ngộ Tính',
      description: 'Một chữ không cần thầy dạy hai lần. Lĩnh ngộ node có xác suất không tốn Cảm Ngộ.',
      rarity: 'linh',
      weight: 28,
      tags: ['mechanic'],
      effects: [{ kind: 'node_cost_free_chance', chance: 0.1 }],
      levels: [
        [{ kind: 'node_cost_free_chance', chance: 0.2 }],
        [{ kind: 'node_cost_free_chance', chance: 0.3 }],
      ],
    },
    {
      id: 'lk_bac_hai',
      name: 'Bác Hải',
      description: 'Trăm sông đổ về biển — tu vi tràn qua tầng không phí một giọt, lại còn tích thành Cảm Ngộ.',
      rarity: 'dia',
      weight: 12,
      tags: ['cultivation', 'mechanic'],
      effects: [{ kind: 'cultivation_overflow_bank' }],
      levels: [
        [
          { kind: 'cultivation_overflow_bank' },
          { kind: 'insight_gain', percent: 0.1 },
        ],
        [
          { kind: 'cultivation_overflow_bank' },
          { kind: 'insight_gain', percent: 0.2 },
        ],
      ],
    },
  ],

  // ==================== TRUC CO pool ====================
  foundation_establishment: [
    {
      id: 'tc_dia_can',
      name: 'Địa Căn',
      description: 'Căn cơ đúc từ đất trời, luyện thể như tôi sắt. Tiến độ Luyện Thể tăng thêm.',
      rarity: 'pham',
      weight: 55,
      tags: ['cultivation'],
      effects: [{ kind: 'body_refinement_progress', percent: 0.15 }],
      levels: [
        [{ kind: 'body_refinement_progress', percent: 0.3 }],
        [{ kind: 'body_refinement_progress', percent: 0.5 }],
      ],
    },
    {
      id: 'tc_thien_co',
      name: 'Thiên Cơ',
      description: 'Đạo lộ trong từng chuyển hóa. Tu vi tích lũy quy đổi Cảm Ngộ nhanh hơn.',
      rarity: 'linh',
      weight: 28,
      tags: ['resource', 'mechanic'],
      effects: [{ kind: 'insight_per_cultivation', cultivationPerInsight: 2000 }],
      levels: [
        [{ kind: 'insight_per_cultivation', cultivationPerInsight: 1500 }],
        [{ kind: 'insight_per_cultivation', cultivationPerInsight: 1000 }],
      ],
    },
    {
      id: 'tc_kim_lan',
      name: 'Kim Lan',
      description: 'Trúc cơ thành, bảo vật tự tìm đến. Linh Thạch nhặt được tăng thêm.',
      rarity: 'pham',
      weight: 55,
      tags: ['resource'],
      effects: [{ kind: 'spirit_stone_gain', percent: 0.2 }],
      levels: [
        [{ kind: 'spirit_stone_gain', percent: 0.4 }],
        [{ kind: 'spirit_stone_gain', percent: 0.65 }],
      ],
    },
    {
      id: 'tc_truc_hon',
      name: 'Trúc Hồn',
      description: 'Hồn phách gắn vào căn cơ, tu vi bế quan cũng không ngừng chảy. Tốc độ tu luyện tăng thêm.',
      rarity: 'linh',
      weight: 28,
      tags: ['cultivation'],
      effects: [{ kind: 'cultivation_speed', percent: 0.15 }],
      levels: [
        [{ kind: 'cultivation_speed', percent: 0.3 }],
        [{ kind: 'cultivation_speed', percent: 0.5 }],
      ],
    },
    {
      id: 'tc_linh_giac',
      name: 'Linh Giác',
      description: 'Ngũ giác thông linh, nhìn trận chiến thấy cả đạo lý. Cảm Ngộ nhận được từ chiến đấu tăng thêm.',
      rarity: 'dia',
      weight: 12,
      tags: ['resource'],
      effects: [{ kind: 'insight_gain', percent: 0.3 }],
      levels: [
        [{ kind: 'insight_gain', percent: 0.6 }],
        [{ kind: 'insight_gain', percent: 1 }],
      ],
    },
    {
      id: 'tc_huyet_nhuc',
      name: 'Huyết Nhục',
      description: 'Trúc cơ tẩy tủy, huyết nhục tự sinh. Diệt địch hồi lại một phần sinh lực.',
      rarity: 'linh',
      weight: 28,
      tags: ['combat'],
      effects: [{ kind: 'heal_on_kill', maxHpPercent: 0.05 }],
      levels: [
        [{ kind: 'heal_on_kill', maxHpPercent: 0.1 }],
        [{ kind: 'heal_on_kill', maxHpPercent: 0.15 }],
      ],
    },
  ],

  // ==================== KIM DAN pool - AUTHORED DORMANT ====================
  // ReleasePolicy (M-F-CEILING) suppresses acquisition while the realm is
  // closed; entries stay authored so the pool is ready when the window
  // advances. Never re-enable by editing weights - the policy gate is
  // the only switch.
  golden_core: [
    {
      id: 'kd_thanh_dan',
      name: 'Thánh Đan',
      description: 'Đan điền ngưng tụ, tu vi như lò luyện đan. Tốc độ tu luyện tăng thêm.',
      rarity: 'dia',
      weight: 12,
      tags: ['cultivation'],
      effects: [{ kind: 'cultivation_speed', percent: 0.2 }],
      levels: [
        [{ kind: 'cultivation_speed', percent: 0.4 }],
      ],
    },
    {
      id: 'kd_linh_dan',
      name: 'Linh Đan',
      description: 'Đan khí thấu vào thần thức, ngộ pháp như uống trà. Cảm Ngộ nhận được từ chiến đấu tăng thêm.',
      rarity: 'thien',
      weight: 4,
      tags: ['resource'],
      effects: [{ kind: 'insight_gain', percent: 0.5 }],
      levels: [
        [{ kind: 'insight_gain', percent: 1 }],
      ],
    },
  ],
}
