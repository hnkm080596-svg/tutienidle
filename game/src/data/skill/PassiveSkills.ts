import type { Skill } from '../../core/skill/Skill'

// 9 passives - one unlocked per major realm. P7-M2: the realm -> skill
// map lives in data/progression/RealmPassiveLadder.ts, composed into
// each way's realmRewards and delivered by
// GameManagerRealmAdvanceOps.syncRealmPassive(). Each uses its own
// passiveTrigger - no shared stacking condition.
export const PASSIVE_SKILLS: Skill[] = [
  {
    id: 'passive_linh_khi_cam_ung',

    name: 'Linh Khí Cảm Ứng',

    description: 'Cảm nhận linh khí xung quanh, mỗi đòn đánh trúng tăng dần công kích.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'qi_refining',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_linh_khi_cam_ung_attack',

        sourceId: 'passive_linh_khi_cam_ung',
        sourceType: 'skill',

        stat: 'might',

        percent: 0.005,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'hit',


  },

  {
    id: 'passive_truc_co_y_chi',

    name: 'Trúc Cơ Ý Chí',

    description: 'Nền tảng đạo tâm vững chắc, mỗi lần chịu đòn tăng dần phòng ngự.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'foundation_establishment',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_truc_co_y_chi_defense',

        sourceId: 'passive_truc_co_y_chi',
        sourceType: 'skill',

        stat: 'defense',

        percent: 0.008,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'damage_taken',


  },

  {
    id: 'passive_kim_dan_chi_quang',

    name: 'Kim Đan Chi Quang',

    description: 'Kim đan tỏa sáng mỗi khi ra đòn chí mạng, tăng dần sát thương chí mạng.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'golden_core',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_kim_dan_chi_quang_crit_damage',

        sourceId: 'passive_kim_dan_chi_quang',
        sourceType: 'skill',

        stat: 'criticalDamage',

        flat: 0.02,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'critical',


  },

  {
    id: 'passive_nguyen_anh_minh_triet',

    name: 'Nguyên Anh Minh Triệt',

    // Phap Tu Redesign (magicpath, 2026-08-18) - cultivationRate da bI
    // xoa khoi Stats (toc do tu luyen gio co dInh, khong ai tang duoc
    // nua), passiveModifiers CU cua skill nay (buff cultivationRate)
    // khong con hop le. TAM de trong, chua gan stat mOi - xem audit
    // cuoi phien [[tienhiep-phap-tu-magicpath]], can quyet dInh lai
    // huOng passive nay (doi sang combat stat, hay bo han) khi lam noi
    // dung "class chinh thuc".
    description:
      'Nguyên Anh thấu triệt — cảm ngộ sâu hơn với thiên địa (hiện chưa có hiệu ứng, đang chờ thiết kế lại).',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'nascent_soul',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [],

    passiveTrigger: 'per_second',


  },

  {
    id: 'passive_hoa_than_chi_uy',

    name: 'Hóa Thần Chi Uy',

    description: 'Uy áp Hóa Thần, mỗi lần hạ gục địch nhân tăng dần sức tấn công.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'soul_transformation',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_hoa_than_chi_uy_attack',

        sourceId: 'passive_hoa_than_chi_uy',
        sourceType: 'skill',

        stat: 'might',

        percent: 0.02,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'kill',


  },

  {
    id: 'passive_luyen_hu_bo',

    name: 'Luyện Hư Bộ',

    description: 'Thân hình hòa vào hư không, mỗi lần thi triển skill tăng dần tốc độ ra đòn.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'void_refinement',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_luyen_hu_bo_speed',

        sourceId: 'passive_luyen_hu_bo',
        sourceType: 'skill',

        stat: 'speed',

        percent: 0.01,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'cast',


  },

  {
    id: 'passive_hop_the_chi_khu',

    name: 'Hợp Thể Chi Khu',

    description: 'Thân thể và thần hồn hợp nhất, mỗi đòn xuất kích tăng dần khí huyết tối đa.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'body_integration',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_hop_the_chi_khu_max_hp',

        sourceId: 'passive_hop_the_chi_khu',
        sourceType: 'skill',

        stat: 'maxHp',

        percent: 0.01,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'attack',


  },

  {
    id: 'passive_dai_thua_dao_tam',

    name: 'Đại Thừa Đạo Tâm',

    description: 'Đạo tâm viên mãn, mỗi đòn đánh trúng tăng dần pháp lực.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'mahayana',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_dai_thua_dao_tam_attunement',

        sourceId: 'passive_dai_thua_dao_tam',
        sourceType: 'skill',

        // TruOc cong %magicAttack (stat da xoa, gop vao tong hop 5
        // hanh) - doi sang Linh Can (Attunement), khOp thang y nghia
        // "dao tam vien man, phap luc tang dan" va tu lan toa deu
        // sang ca 6 hanh qua tang dan xuat (xem
        // StatCalculator.deriveAttributeModifiers()).
        stat: 'attunement',

        percent: 0.015,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'hit',


  },

  {
    id: 'passive_do_kiep_chi_tam',

    name: 'Độ Kiếp Chi Tâm',

    description: 'Tâm cảnh kiên định qua thiên kiếp, mỗi giây trong trận tăng dần tỉ lệ chí mạng.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'tribulation',

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_do_kiep_chi_tam_crit_rate',

        sourceId: 'passive_do_kiep_chi_tam',
        sourceType: 'skill',

        stat: 'criticalRate',

        flat: 0.002,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'per_second',


  },

  // Combat innate of the retired thai_hu_kiem_quyet - P7-M3: the
  // technique is gone and nothing grants this passive today (orphan
  // catalog entry, same status as its retired parent).
  {
    id: 'passive_thai_hu_kiem_y',

    name: 'Thái Hư Kiếm Ý',

    description: 'Kiếm ý thấu triệt hư vô, mỗi đòn chí mạng dồn thêm sát khí.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_thai_hu_kiem_y_crit_damage',

        sourceId: 'passive_thai_hu_kiem_y',
        sourceType: 'skill',

        stat: 'criticalDamage',

        percent: 0.01,

        stacks: 0,

        maxStacks: 30,
      },
    ],

    passiveTrigger: 'critical',


  },

  {
    id: 'passive_kim_cang_y_chi',

    name: 'Kim Cang Ý Chí',

    description: 'Thân thể cứng như kim thạch, mỗi đòn chịu đau càng thêm vững vàng.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,



    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_kim_cang_y_chi_defense',

        sourceId: 'passive_kim_cang_y_chi',
        sourceType: 'skill',

        stat: 'defense',

        percent: 0.008,

        stacks: 0,

        maxStacks: 30,
      },
    ],

    passiveTrigger: 'damage_taken',


  },
]
