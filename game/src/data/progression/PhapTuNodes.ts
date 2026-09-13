import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { FOUNDATION, buildBranch, buildThuanBranch, skillMod, stat } from './PhapTuNodes.builders'

export const PHAP_TU_NODES: ProgressionNode[] = [
  ...buildBranch({
    tag: 'fire',

    rootId: 'hoa_linh_ngo',

    rootName: 'Hỏa Cầu Thuật',

    rootDescription:
      'Học Hỏa Cầu Thuật — root của Hỏa skill tree, luôn có sẵn miễn phí lúc chọn Pháp Tu.',

    rootCost: 0,

    rootSkillIds: ['hoa_cau_thuat'],

    power: { id: 'minor_fire_intensity', name: 'Hỏa Linh', stat: 'firePower' },

    cadence: {
      id: 'minor_fire_haste',

      name: 'Tật Hỏa',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_fire_haste', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_fire_burn',

      name: 'Xích Viêm',

      description: '+4% Sát Thương Thiêu Đốt (ailment potency) mỗi cấp.',

      effect: { statModifiers: [stat('minor_fire_burn', 'ailmentPotencyPercent', 0.04, 0.04)] },
    },

    keystoneReaction: {
      id: 'hoa_truc_co_dan_hoa',

      name: 'Dẫn Hỏa',

      description:
        '+15% Tỉ Lệ Áp Nguyên Tố (Thiêu Đốt) của Hỏa Cầu Thuật — mở khoá nhánh Minor Reaction.',

      effect: {
        statModifiers: [stat('hoa_truc_co_dan_hoa', 'elementApplicationPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'hoa_truc_co_tu_hoa',

      name: 'Tụ Hỏa',

      description:
        'Mỗi lần dùng Hỏa Cầu Thuật tích 1 Hỏa Thế — mở khoá nhánh Minor Pure (keystone đối diện bị khoá).',

      effect: { skillModifiers: skillMod('hoa_cau_thuat', [{ stat: 'hoaTheGainPerCast', flat: 1 }]) },
    },

    reactionSpecs: [
      {
        id: 'minor_fire_application',

        name: 'Hỏa Nguyên',

        description: '+2% Tỉ Lệ Áp Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_fire_application', 'elementApplicationPercent', 0.02, 0.02)] },
      },

      {
        id: 'minor_fire_reaction_effect',

        name: 'Cộng Minh',

        description: '+5% Sát Thương Phản Ứng Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_fire_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_fire_heart',

        name: 'Hỏa Tâm',

        description: '+3 Hỏa Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_fire_heart', 'firePower', 3, 3)] },
      },

      {
        id: 'minor_fire_channeling',

        name: 'Hỏa Mạch',

        description: '+2% Hỏa Thế tích mỗi lượt mỗi cấp (cấp 5 = +10%).',

        effect: {
          skillModifiers: skillMod('hoa_cau_thuat', [
            { stat: 'hoaTheGainPerCast', flat: 0.02, perLevelFlat: 0.02 },
          ]),
        },
      },

      {
        id: 'minor_fire_retention',

        name: 'Tụ Viêm',

        description: 'Hỏa Thế giảm chậm hơn 2% mỗi cấp (cấp 5 = 10%).',

        effect: {
          skillModifiers: skillMod('hoa_cau_thuat', [
            { stat: 'hoaTheDecayReductionPercent', flat: 0.02, perLevelFlat: 0.02 },
          ]),
        },
      },
    ],
  }),

  ...buildBranch({
    tag: 'wood',

    rootId: 'moc_linh_ngo',

    rootName: 'Độc Chưởng',

    rootDescription:
      'Học Độc Chưởng — root của Mộc skill tree, mở khoá toàn bộ Node Tree Mộc (Luyện Khí + Trúc Cơ).',

    rootCost: 2,

    rootSkillIds: ['doc_chuong'],

    power: { id: 'minor_wood_intensity', name: 'Độc Nguyên', stat: 'woodPower' },

    cadence: {
      id: 'minor_wood_threshold',

      name: 'Độc Mạch',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_wood_threshold', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_wood_duration',

      name: 'Độc Tức',

      description: '+4% Thời Gian Hiệu Lực Độc mỗi cấp.',

      effect: { statModifiers: [stat('minor_wood_duration', 'ailmentDurationPercent', 0.04, 0.04)] },
    },

    keystoneReaction: {
      id: 'moc_truc_co_doc_dan',

      name: 'Độc Dẫn',

      description:
        '+15% Sát Thương Phản Ứng Nguyên Tố — mở khoá nhánh Reaction (Độc Viêm...).',

      effect: {
        statModifiers: [stat('moc_truc_co_doc_dan', 'reactionEffectPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'moc_truc_co_doc_can',

      name: 'Mộc Thế',

      description:
        'Độc Căn tối đa +1 tầng — mở khoá nhánh Pure Mộc Thế (keystone đối diện bị khoá).',

      effect: { skillModifiers: skillMod('doc_chuong', [{ stat: 'poisonRootMaxStacks', flat: 1 }]) },
    },

    reactionSpecs: [
      {
        id: 'minor_wood_reaction_effect',

        name: 'Cộng Độc',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },

      {
        id: 'minor_wood_potency',

        name: 'Độc Thực',

        description: '+3% Sát Thương Độc (potency) mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_potency', 'ailmentPotencyPercent', 0.03, 0.03)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_wood_heart',

        name: 'Độc Linh',

        description: '+3 Mộc Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_heart', 'woodPower', 3, 3)] },
      },

      {
        id: 'minor_wood_channeling',

        name: 'Độc Uyển',

        description: 'Độc Căn tối đa +1 tầng ở cấp 1, +3 tầng ở cấp 5.',

        effect: {
          skillModifiers: skillMod('doc_chuong', [
            { stat: 'poisonRootMaxStacks', flat: 1, perLevelFlat: 0.5 },
          ]),
        },
      },

      {
        id: 'minor_wood_duration_chung',

        name: 'Độc Trưởng',

        description: '+3% Thời Gian Độc mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_duration_chung', 'ailmentDurationPercent', 0.03, 0.03)] },
      },
    ],
  }),

  ...buildBranch({
    tag: 'water',

    rootId: 'thuy_linh_ngo',

    rootName: 'Thủy Tiễn Thuật',

    rootDescription:
      'Học Thủy Tiễn Thuật — root của Thủy skill tree, mở khoá toàn bộ Node Tree Thủy.',

    rootCost: 2,

    rootSkillIds: ['thuy_tien_thuat'],

    power: { id: 'minor_water_intensity', name: 'Thủy Linh', stat: 'waterPower' },

    cadence: {
      id: 'minor_water_haste',

      name: 'Thủy Tốc',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_water_haste', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_water_cast_speed',

      name: 'Lưu Tốc',

      description: '+2% Giảm Cooldown kỹ năng mỗi cấp.',

      effect: { statModifiers: [stat('minor_water_cast_speed', 'speed', 2, 2)] },
    },

    keystoneReaction: {
      id: 'thuy_truc_co_dan_luu',

      name: 'Dẫn Lưu',

      description:
        '+15% Tỉ Lệ Áp Nguyên Tố — mở khoá nhánh Reaction Thủy (Dẫn Lưu).',

      effect: {
        statModifiers: [stat('thuy_truc_co_dan_luu', 'elementApplicationPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'thuy_truc_co_tu_thuy',

      name: 'Tụ Thủy',

      description:
        'Thủy Thế +5% — mở khoá nhánh Pure Tụ Thủy (keystone đối diện bị khoá).',

      effect: { skillModifiers: skillMod('thuy_tien_thuat', [{ stat: 'thuyThePercent', flat: 0.05 }]) },
    },

    reactionSpecs: [
      {
        id: 'minor_water_application',

        name: 'Thủy Dẫn',

        description: '+2% Tỉ Lệ Áp Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_water_application', 'elementApplicationPercent', 0.02, 0.02)] },
      },

      {
        id: 'minor_water_reaction_effect',

        name: 'Cộng Lưu',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_water_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_water_heart',

        name: 'Thủy Nguyên',

        description: '+3 Thủy Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_water_heart', 'waterPower', 3, 3)] },
      },

      {
        id: 'minor_water_channeling',

        name: 'Thủy Mạch',

        description: '+1% Thủy Thế mỗi cấp.',

        effect: {
          skillModifiers: skillMod('thuy_tien_thuat', [
            { stat: 'thuyThePercent', flat: 0.01, perLevelFlat: 0.01 },
          ]),
        },
      },

      {
        id: 'minor_water_softness',

        name: 'Nhuyễn Lưu',

        description: '+1% Thủy Thế mỗi cấp.',

        effect: {
          skillModifiers: skillMod('thuy_tien_thuat', [
            { stat: 'thuyThePercent', flat: 0.01, perLevelFlat: 0.01 },
          ]),
        },
      },
    ],
  }),

  ...buildBranch({
    tag: 'metal',

    rootId: 'kim_linh_ngo',

    rootName: 'Điểm Kim Thuật',

    rootDescription:
      'Học Điểm Kim Thuật — root của Kim skill tree, mở khoá toàn bộ Node Tree Kim.',

    rootCost: 2,

    rootSkillIds: ['diem_kim_thuat'],

    power: { id: 'minor_metal_intensity', name: 'Kim Khí', stat: 'metalPower' },

    cadence: {
      id: 'minor_metal_burst',

      name: 'Huyết Bạo',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_metal_burst', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_metal_bleed_damage',

      name: 'Huyết Ấn',

      description: '+4% Sát Thương Chảy Máu (potency) mỗi cấp.',

      effect: { statModifiers: [stat('minor_metal_bleed_damage', 'ailmentPotencyPercent', 0.04, 0.04)] },
    },

    keystoneReaction: {
      id: 'kim_truc_co_huyet_dan',

      name: 'Huyết Dẫn',

      description:
        '+15% Sát Thương Phản Ứng — mở khoá nhánh Reaction Kim (Huyết Dẫn).',

      effect: {
        statModifiers: [stat('kim_truc_co_huyet_dan', 'reactionEffectPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'kim_truc_co_kim_the',

      name: 'Kim Thế',

      description:
        'Mỗi lần Xuất Huyết áp thành công tích 1 Kim Thế (tối đa +1 tầng) — mở khoá nhánh Pure Kim Thế (keystone đối diện bị khoá).',

      effect: {
        skillModifiers: skillMod('diem_kim_thuat', [
          { stat: 'kimTheGainPerProc', flat: 1 },

          { stat: 'kimTheMaxStacksBonus', flat: 1 },
        ]),
      },
    },

    reactionSpecs: [
      {
        id: 'minor_metal_application',

        name: 'Điểm Huyệt',

        description: '+2% Tỉ Lệ Áp Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_metal_application', 'elementApplicationPercent', 0.02, 0.02)] },
      },

      {
        id: 'minor_metal_reaction_effect',

        name: 'Cộng Huyết',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_metal_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_metal_channeling',

        name: 'Kim Uyển',

        description: 'Kim Thế tối đa +1 tầng ở cấp 1, +3 tầng ở cấp 5.',

        effect: {
          skillModifiers: skillMod('diem_kim_thuat', [
            { stat: 'kimTheMaxStacksBonus', flat: 1, perLevelFlat: 0.5 },
          ]),
        },
      },

      {
        id: 'minor_metal_shatter',

        name: 'Huyết Phá',

        description:
          'Mỗi lần Xuất Huyết áp thành công tích 1 Huyết Phá — chạm ngưỡng nổ 1 cục burst (mỗi cấp +0.5% Xuyên DOT RES mỗi tầng Kim Thế).',

        effect: {
          skillModifiers: skillMod('diem_kim_thuat', [
            { stat: 'kimTheDotResistancePenetrationPercentPerStack', flat: 0.005, perLevelFlat: 0.005 },

            { stat: 'huyetPhaGainPerProc', flat: 1 },

            { stat: 'huyetPhaBurstDamage', flat: 60 },
          ]),
        },
      },

      {
        id: 'minor_metal_heart',

        name: 'Kim Tâm',

        description: '+3 Kim Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_metal_heart', 'metalPower', 3, 3)] },
      },
    ],
  }),

  ...buildBranch({
    tag: 'earth',

    rootId: 'tho_linh_ngo',

    rootName: 'Thổ Cầu Thuật',

    rootDescription:
      'Học Thổ Cầu Thuật — root của Thổ skill tree, mở khoá toàn bộ Node Tree Thổ.',

    rootCost: 2,

    rootSkillIds: ['tho_cau_thuat'],

    power: { id: 'minor_earth_intensity', name: 'Thổ Nguyên', stat: 'earthPower' },

    cadence: {
      id: 'minor_earth_haste',

      name: 'Thổ Tốc',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_earth_haste', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_earth_impact',

      name: 'Chấn Lực',

      description: '+2% Sát Thương Kỹ Năng mỗi cấp.',

      effect: {
        skillModifiers: skillMod('tho_cau_thuat', [
          { stat: 'skillImpactPercent', flat: 0.02, perLevelFlat: 0.02 },
        ]),
      },
    },

    keystoneReaction: {
      id: 'tho_truc_co_dinh_tho',

      name: 'Định Thổ',

      description:
        '+15% Sát Thương Phản Ứng — mở khoá nhánh Reaction Thổ (Định Thổ).',

      effect: {
        statModifiers: [stat('tho_truc_co_dinh_tho', 'reactionEffectPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'tho_truc_co_tho_the',

      name: 'Thổ Thế',

      description:
        'Mỗi lần thi triển Thổ Cầu Thuật tích 1 Thổ Thế, +5% Sát Thương Kỹ Năng — mở khoá nhánh Pure Thổ Thế (keystone đối diện bị khoá).',

      effect: {
        skillModifiers: skillMod('tho_cau_thuat', [
          { stat: 'thoTheGainPerCast', flat: 1 },

          { stat: 'skillImpactPercent', flat: 0.05 },
        ]),
      },
    },

    reactionSpecs: [
      {
        id: 'minor_earth_reaction_effect',

        name: 'Định Lực',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_earth_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },

      {
        id: 'minor_earth_knockback',

        name: 'Trọng Thạch',

        description: '+2% Sát Thương Kỹ Năng mỗi cấp.',

        effect: { statModifiers: [stat('minor_earth_knockback', 'skillDamagePercent', 0.02, 0.02)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_earth_aoe',

        name: 'Chấn Vực',

        description:
          'Bán kính AOE Thổ +1 ô ở cấp 1, +2 ô ở cấp 5 (data làm tròn xuống).',

        effect: {
          skillModifiers: skillMod('tho_cau_thuat', [
            { stat: 'earthAoeRadius', flat: 1, perLevelFlat: 0.25 },
          ]),
        },
      },

      {
        id: 'minor_earth_heart',

        name: 'Thổ Tâm',

        description: '+3 Thổ Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_earth_heart', 'earthPower', 3, 3)] },
      },
    ],
  }),

  // ==================================================================
  // Pháp Tu Thuần Hệ (spec 2026-09-03 §5, Task 11) — nhánh Thuần: gate
  // Lập Đạo chung → Lập Đạo Thuần per-hành (loại trừ đa pháp) → unlock
  // B/C/D/E (realm gate khớp REALM_SLOT_TABLE: C=golden_core,
  // D=soul_transformation, E=tribulation) → biến thể C/D (2 chọn 1,
  // selectsSpecialization E-8) → ult (prereq B — N5) → Thế (Tụ/Trường/
  // Mãn). 13 node mới × 5 hành + 2 node chung = 67. Keystone Trúc Cơ
  // CŨ KHÔNG xoá (N4 — dọn riêng sau Đa Pháp).
  // ==================================================================

  // Cổng chung mọi nhánh Đạo — gate Trúc Cơ, cost 0 (spec §5.1).
  {
    id: 'phap_tu_lap_dao',
    name: 'Lập Đạo',
    description:
      'Đứng trên Trúc Cơ, nhìn khắp Ngũ Hành mà lập đạo — cổng chung cho nhánh Thuần lẫn Đa Pháp.',
    type: 'major',
    role: 'keystone',
    insightCost: 0,
    prerequisites: [FOUNDATION],
    effect: {},
    branchTag: 'lap_dao',
  },

  // Placeholder ĐA PHÁP — chỉ khai để lap_dao_thuan_* trỏ excludesNode
  // tới; nội dung nhánh Đa Pháp theo plan cha Task 11 phần còn lại.
  {
    id: 'phap_tu_lap_dao_da_phap',
    name: 'Lập Đạo · Đa Pháp',
    description: 'Đạo của kẻ thu phục nhiều hành — nội dung khai sau (plan cha).',
    type: 'major',
    role: 'keystone',
    insightCost: 0,
    prerequisites: [FOUNDATION],
    effect: {},
    branchTag: 'da_phap',
  },

  ...buildThuanBranch('fire'),
  ...buildThuanBranch('water'),
  ...buildThuanBranch('wood'),
  ...buildThuanBranch('metal'),
  ...buildThuanBranch('earth'),
]
