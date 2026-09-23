import type { Technique } from '../../core/technique/Technique'

// P7-M3 - Canonical Technique catalog. Exactly ONE canonical technique
// per committed Way (D12), granted at initiation (no learn-by-drop, no
// generic list/equip). Ids are semantic English on the M1 spine. Each
// entry is a grant template: grade 1 / rank 0 / mastery 0 / quality
// 'hoang'. Progression semantics live in core/technique/
// TechniqueProgression.ts; live instances in TechniqueManager.
//
// Grade effects: gradeEffects[grade][rankBand]. The spell Truc Co
// variant (retired dai_ngu_hanh_quyet_truc_co) is FOLDED into
// five_elements_art.gradeEffects[2] - earned via the grade-advance
// transaction, not a technique swap.
export const TECHNIQUES: Technique[] = [
  // spell_pathway - carries the folded Truc Co table at grade 2.
  {
    id: 'five_elements_art',

    name: 'Tiểu Ngũ Hành Quyết',

    icon: '/assets/techniques/dai_ngu_hanh_chan_quyet.png',

    description:
      'Cho khả năng cảm ngộ ngũ đại nguyên tố trong tự nhiên — Kim, Mộc, Thủy, Hỏa, Thổ đều có thể dung hợp vào một thân, vận dụng tuỳ ý qua từng chiêu thức.',

    resourceLabel: 'Pháp Lực',

    // Grade 1 = old dai_ngu_hanh_chan_quyet table (PLAN HOAN CHINH
    // muc 5.2 - %Linh luc toi da 3->4->5->10, %Hoi Linh Increased
    // manaRegenPerTurn 0.5->0.75->1.5->2).
    // Grade 2 = folded dai_ngu_hanh_quyet_truc_co table (Dai Ngu Hanh
    // Quyet - ban Truc Co ke thua, %Linh luc 5->7->10->15, %Hoi Linh
    // 1->1.5->2.5->4).
    gradeEffects: {
      1: {
        so_nhap: { maxMpIncreasePercent: 0.03, manaRegenIncreasePercent: 0.005, hpRegenFlat: 0.5, mpRegenFlat: 0.5 },
        tieu_thanh: { maxMpIncreasePercent: 0.04, manaRegenIncreasePercent: 0.0075, hpRegenFlat: 0.75, mpRegenFlat: 0.75 },
        dai_thanh: { maxMpIncreasePercent: 0.05, manaRegenIncreasePercent: 0.015, hpRegenFlat: 1.5, mpRegenFlat: 1.5 },
        vien_man: { maxMpIncreasePercent: 0.1, manaRegenIncreasePercent: 0.02, hpRegenFlat: 2, mpRegenFlat: 2 },
      },
      2: {
        so_nhap: { maxMpIncreasePercent: 0.05, manaRegenIncreasePercent: 0.01, hpRegenFlat: 1, mpRegenFlat: 1 },
        tieu_thanh: { maxMpIncreasePercent: 0.07, manaRegenIncreasePercent: 0.015, hpRegenFlat: 1.5, mpRegenFlat: 1.5 },
        dai_thanh: { maxMpIncreasePercent: 0.1, manaRegenIncreasePercent: 0.025, hpRegenFlat: 2.5, mpRegenFlat: 2.5 },
        vien_man: { maxMpIncreasePercent: 0.15, manaRegenIncreasePercent: 0.04, hpRegenFlat: 4, mpRegenFlat: 4 },
      },
    },

    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  },

  // hidden_spell_pathway (Phap Tu An) - Ngo Dao signature.
  {
    id: 'dao_insight_art',

    name: 'Ngộ Đạo Chân Quyết',

    icon: '/assets/techniques/dai_ngu_hanh_chan_quyet.png',

    description:
      'Chân quyết của kẻ ngộ đạo giữa muôn pháp — vạn pháp tùy tâm, đa pháp liên tuyên.',

    resourceLabel: 'Pháp Lực',

    gradeEffects: {
      1: {
        so_nhap: { maxMpIncreasePercent: 0.03, manaRegenIncreasePercent: 0.005, hpRegenFlat: 0.5, mpRegenFlat: 0.5 },
        tieu_thanh: { maxMpIncreasePercent: 0.04, manaRegenIncreasePercent: 0.0075, hpRegenFlat: 0.75, mpRegenFlat: 0.75 },
        dai_thanh: { maxMpIncreasePercent: 0.05, manaRegenIncreasePercent: 0.015, hpRegenFlat: 1.5, mpRegenFlat: 1.5 },
        vien_man: { maxMpIncreasePercent: 0.1, manaRegenIncreasePercent: 0.02, hpRegenFlat: 2, mpRegenFlat: 2 },
      },
    },

    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  },

  // sword_pathway - Ngu Kiem signature (old ngu_kiem table).
  {
    id: 'sword_control_art',

    name: 'Ngự Kiếm Tâm Kinh',

    icon: '/assets/techniques/ngu_kiem.png',

    description:
      'Tâm pháp Kiếm hệ, dạy cách ngự sử phi kiếm vây quanh — kiếm ý ngưng tụ theo từng đòn.',

    combatTypeId: 'crit',

    element: 'metal',

    gradeEffects: {
      1: {
        so_nhap: { hpRegenFlat: 1.5, mpRegenFlat: 0.25 },
        tieu_thanh: { hpRegenFlat: 2, mpRegenFlat: 0.5 },
        dai_thanh: { hpRegenFlat: 3, mpRegenFlat: 1 },
        vien_man: { hpRegenFlat: 4, mpRegenFlat: 1.5 },
      },
    },

    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  },

  // hidden_sword_pathway - Ngu Kiem Dao signature (old van_kiem_quyet).
  {
    id: 'myriad_swords_art',

    name: 'Vạn Kiếm Quyết',

    icon: '/assets/techniques/van_kiem_quyet.png',

    description:
      'Tâm pháp Ngự Kiếm Đạo — vạn kiếm quy tông, mỗi phi kiếm tự quyết sát chiêu.',

    gradeEffects: {
      1: {
        so_nhap: { hpRegenFlat: 1, mpRegenFlat: 1 },
        tieu_thanh: { hpRegenFlat: 2, mpRegenFlat: 2 },
        dai_thanh: { hpRegenFlat: 3, mpRegenFlat: 3 },
        vien_man: { hpRegenFlat: 4, mpRegenFlat: 4 },
      },
    },

    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  },

  // body_pathway - old kim_cang_bat_hoai_the table.
  {
    id: 'diamond_body_art',

    name: 'Kim Cang Bất Hoại Thể',

    icon: '/assets/techniques/iron_body_scripture.png',

    description: 'Luyện thân cứng như kim thạch, phòng ngự vượt trội.',

    combatTypeId: 'def',

    gradeEffects: {
      1: {
        so_nhap: { hpRegenFlat: 2, mpRegenFlat: 0.25 },
        tieu_thanh: { hpRegenFlat: 3, mpRegenFlat: 0.5 },
        dai_thanh: { hpRegenFlat: 4, mpRegenFlat: 0.75 },
        vien_man: { hpRegenFlat: 6, mpRegenFlat: 1 },
      },
    },

    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  },

  // hidden_body_pathway - old ung_the_than_quyet table.
  {
    id: 'responsive_body_art',

    name: 'Ứng Thế Thần Quyết',

    icon: '/assets/techniques/iron_body_scripture.png',

    description: 'Tâm quyết luyện thân theo lối ứng thế — nhu hóa cương, tĩnh chờ động.',

    combatTypeId: 'def',

    gradeEffects: {
      1: {
        so_nhap: { hpRegenFlat: 1.5, mpRegenFlat: 0.5 },
        tieu_thanh: { hpRegenFlat: 2.5, mpRegenFlat: 0.75 },
        dai_thanh: { hpRegenFlat: 3.5, mpRegenFlat: 1 },
        vien_man: { hpRegenFlat: 5, mpRegenFlat: 1.5 },
      },
    },

    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  },
]
