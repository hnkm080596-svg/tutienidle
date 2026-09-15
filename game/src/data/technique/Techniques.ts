import type { Technique } from '../../core/technique/Technique'

// Pháp Tu Redesign (magicpath, 2026-08-18) — Tâm Pháp KHÔNG còn cộng
// chỉ số dưới bất kỳ hình thức nào (đã xoá modifiers/mechanic/
// breakthroughEffect khỏi Technique.ts, cùng lúc cultivationRate bị
// xoá HOÀN TOÀN khỏi Stats — tốc độ tu luyện giờ cố định
// BASE_CULTIVATION_PER_SECOND, xem core/realm/realmSystem.ts). Tâm
// Pháp giờ THUẦN là lớp giới thiệu/hướng dẫn (description hoa mỹ giải
// thích path chơi ra sao), tự động trang bị khi chọn path — mọi chỉ
// số thật chuyển sang Node Tree (core/progression/) khi nội dung
// "class chính thức" được xây (xem [[tienhiep-phap-tu-magicpath]]).
export const TECHNIQUES: Technique[] = [
  // Pháp Tu Redesign (magicpath, 2026-08-18) — THAY hẳn 5 tâm pháp
  // Ngũ Hành riêng (xich_viem/thanh_dang/huyen_bang/huyen_thiet/
  // hau_tho, đã xoá) bằng 1 tâm pháp DUY NHẤT, tự động trang bị khi
  // chọn path "Pháp Tu" (xem CultivationPathKit.ts). KHÔNG khai
  // `element` (Pháp Tu giờ multi-element qua Element Loadout, không
  // còn 1 hành cố định) — identity/skill của TỪNG hành giờ đến từ
  // Node Tree khi unlock hành đó (xem data/progression/PhapTuNodes.ts),
  // technique này chỉ còn vai trò flavor + tài nguyên chung (Rage bar
  // "Pháp Lực", MP bar "Linh Lực").
  {
    id: 'dai_ngu_hanh_chan_quyet',

    insightMultiplier: 3,

    name: 'Tiểu Ngũ Hành Quyết',

    icon: '/assets/techniques/dai_ngu_hanh_chan_quyet.png',

    description:
      'Cho khả năng cảm ngộ ngũ đại nguyên tố trong tự nhiên — Kim, Mộc, Thủy, Hỏa, Thổ đều có thể dung hợp vào một thân, vận dụng tuỳ ý qua từng chiêu thức.',

    resourceLabel: 'Pháp Lực',

    // PLAN HOÀN CHỈNH mục 5.2 — Đại Ngũ Hành: %Linh lực tối đa
    // 3→4→5→10, %Hồi Linh (Increased manaRegenPerTurn, KHÔNG phải %
    // maxMp — xem Technique.ts's TechniqueTierEffect) 0.5→0.75→1.5→2,
    // giá trị Đại Thành đã chốt lại với user (doc gốc ghi nhầm 0.1%).
    tierEffects: {
      so_nhap: { maxMpIncreasePercent: 0.03, manaRegenIncreasePercent: 0.005, hpRegenFlat: 0.5, mpRegenFlat: 0.5 },
      tieu_thanh: { maxMpIncreasePercent: 0.04, manaRegenIncreasePercent: 0.0075, hpRegenFlat: 0.75, mpRegenFlat: 0.75 },
      dai_thanh: { maxMpIncreasePercent: 0.05, manaRegenIncreasePercent: 0.015, hpRegenFlat: 1.5, mpRegenFlat: 1.5 },
      vien_man: { maxMpIncreasePercent: 0.1, manaRegenIncreasePercent: 0.02, hpRegenFlat: 2, mpRegenFlat: 2 },
    },

    // Task 3 (D16): the fixed +2 range combat modifier retired with the
    // attackRange stat — reach is now action targeting, not a character
    // stat, so this technique grants no combatModifiers.

    unlocked: false,

    equipped: false,
  },

  {
    id: 'dai_ngu_hanh_quyet_truc_co',
    insightMultiplier: 4,
    name: 'Đại Ngũ Hành Quyết',
    icon: '/assets/techniques/dai_ngu_hanh_chan_quyet.png',
    description: 'Bản Trúc Cơ kế thừa Tiểu Ngũ Hành Quyết, dung nạp linh lực sâu hơn và điều động ngũ hành mạnh hơn.',
    requiredRealmId: 'foundation_establishment',
    resourceLabel: 'Pháp Lực',
    tierEffects: {
      so_nhap: { maxMpIncreasePercent: 0.05, manaRegenIncreasePercent: 0.01, hpRegenFlat: 1, mpRegenFlat: 1 },
      tieu_thanh: { maxMpIncreasePercent: 0.07, manaRegenIncreasePercent: 0.015, hpRegenFlat: 1.5, mpRegenFlat: 1.5 },
      dai_thanh: { maxMpIncreasePercent: 0.1, manaRegenIncreasePercent: 0.025, hpRegenFlat: 2.5, mpRegenFlat: 2.5 },
      vien_man: { maxMpIncreasePercent: 0.15, manaRegenIncreasePercent: 0.04, hpRegenFlat: 4, mpRegenFlat: 4 },
    },
    unlocked: false,
    equipped: false,
  },

  // Phap Tu An (Task 7, phap-tu-reimagined) — tâm pháp của path ẩn.
  // innateSkillId carries the dao passive: equipTechnique auto-learns +
  // equipWithoutSlot's ngo_dao_hon_don (no new wiring needed).
  {
    id: 'ngo_dao_chan_quyet',

    insightMultiplier: 3,

    name: 'Ngộ Đạo Chân Quyết',

    icon: '/assets/techniques/dai_ngu_hanh_chan_quyet.png',

    description:
      'Chân quyết của kẻ ngộ đạo giữa muôn pháp — vạn pháp tùy tâm, đa pháp liên tuyên.',

    resourceLabel: 'Pháp Lực',

    innateSkillId: 'ngo_dao_hon_don',

    tierEffects: {
      so_nhap: { maxMpIncreasePercent: 0.03, manaRegenIncreasePercent: 0.005, hpRegenFlat: 0.5, mpRegenFlat: 0.5 },
      tieu_thanh: { maxMpIncreasePercent: 0.04, manaRegenIncreasePercent: 0.0075, hpRegenFlat: 0.75, mpRegenFlat: 0.75 },
      dai_thanh: { maxMpIncreasePercent: 0.05, manaRegenIncreasePercent: 0.015, hpRegenFlat: 1.5, mpRegenFlat: 1.5 },
      vien_man: { maxMpIncreasePercent: 0.1, manaRegenIncreasePercent: 0.02, hpRegenFlat: 2, mpRegenFlat: 2 },
    },

    unlocked: false,

    equipped: false,
  },

  // Kiếm Tu (2026-08-15) — nhánh SONG SONG với Ngũ Hành Pháp Tu (Phàm
  // Nhân -> Pháp Tu -> Ngũ Hành / -> Kiếm Tu / -> Thể Tu sau này), tái
  // dùng NGUYÊN VẸN cùng cơ chế "chọn 1 lần, cấp trọn kit" (xem
  // CultivationPathKit.ts) thay vì xây hệ thống chọn nghề riêng —
  // KHÔNG phải 1 trong 5 hành, chỉ đứng chung 1 danh sách lựa chọn cho
  // đơn giản.
  {
    id: 'ngu_kiem',

    insightMultiplier: 3,

    name: 'Ngự Kiếm Tâm Kinh',

    icon: '/assets/techniques/ngu_kiem.png',

    description:
      'Tâm pháp Kiếm hệ, dạy cách ngự sử phi kiếm vây quanh — kiếm ý ngưng tụ theo từng đòn.',

    combatTypeId: 'crit',

    element: 'metal',

    // Nội tại chiến đấu — passive_kiem_tam_lanh (xem data/skill/Skills.ts).
    innateSkillId: 'passive_kiem_tam_lanh_liet',

    // HP/s & MP/s mặc định (yêu cầu 2026-08-26) — kiếm tu thiên hồi máu.
    tierEffects: {
      so_nhap: { hpRegenFlat: 1.5, mpRegenFlat: 0.25 },
      tieu_thanh: { hpRegenFlat: 2, mpRegenFlat: 0.5 },
      dai_thanh: { hpRegenFlat: 3, mpRegenFlat: 1 },
      vien_man: { hpRegenFlat: 4, mpRegenFlat: 1.5 },
    },

    unlocked: false,

    equipped: false,
  },

  {
    id: 'thai_hu_kiem_quyet',

    name: 'Thái Hư Kiếm Quyết',

    icon: '/assets/techniques/tai_hu_sword.png',

    description: 'Một bộ kiếm quyết lấy hư vô làm ý, kiếm thế vô cùng vô tận.',

    combatTypeId: 'crit',

    requiredRealmId: 'qi_refining',

    requiredRealmLevel: 3,

    // Nội tại chiến đấu — passive_tai_hu_edge (xem data/skill/Skills.ts).
    innateSkillId: 'passive_thai_hu_kiem_y',

    // HP/s & MP/s mặc định (yêu cầu 2026-08-26) — kiếm tu thiên hồi máu.
    tierEffects: {
      so_nhap: { hpRegenFlat: 1, mpRegenFlat: 0.5 },
      tieu_thanh: { hpRegenFlat: 1.5, mpRegenFlat: 0.75 },
      dai_thanh: { hpRegenFlat: 2, mpRegenFlat: 1.5 },
      vien_man: { hpRegenFlat: 3, mpRegenFlat: 2 },
    },

    unlocked: false,

    equipped: false,
  },

  {
    id: 'kim_cang_bat_hoai_the',

    name: 'Kim Cang Bất Hoại Thể',

    icon: '/assets/techniques/iron_body_scripture.png',

    description: 'Luyện thân cứng như kim thạch, phòng ngự vượt trội.',

    combatTypeId: 'def',

    // Nội tại chiến đấu — passive_iron_body_resolve.
    innateSkillId: 'passive_kim_cang_y_chi',

    // HP/s & MP/s mặc định (yêu cầu 2026-08-26) — thể tu hồi máu mạnh.
    tierEffects: {
      so_nhap: { hpRegenFlat: 2, mpRegenFlat: 0.25 },
      tieu_thanh: { hpRegenFlat: 3, mpRegenFlat: 0.5 },
      dai_thanh: { hpRegenFlat: 4, mpRegenFlat: 0.75 },
      vien_man: { hpRegenFlat: 6, mpRegenFlat: 1 },
    },

    unlocked: false,

    equipped: false,
  },

  // The Tu Reimagined (spec 2026-09-15, T1/T6) — the_tu_an signature
  // technique, granted by the Initiation Ritual when huy_quyen is Lv3.
  // Defensive/reactive body art: same def typing as kim_cang, leaning
  // on regen so the hidden path survives long enough to proc.
  {
    id: 'ung_the_than_quyet',

    name: 'Ứng Thể Thần Quyết',

    icon: '/assets/techniques/iron_body_scripture.png',

    description: 'Tâm quyết luyện thân theo lối ứng thế — nhu hóa cương, tĩnh chờ động.',

    combatTypeId: 'def',

    tierEffects: {
      so_nhap: { hpRegenFlat: 1.5, mpRegenFlat: 0.5 },
      tieu_thanh: { hpRegenFlat: 2.5, mpRegenFlat: 0.75 },
      dai_thanh: { hpRegenFlat: 3.5, mpRegenFlat: 1 },
      vien_man: { hpRegenFlat: 5, mpRegenFlat: 1.5 },
    },

    unlocked: false,

    equipped: false,
  },

  {
    id: 'tu_linh_quyet',

    name: 'Tụ Linh Quyết',

    icon: '/assets/techniques/spirit_gathering_scripture.png',

    description:
      'Công pháp tu luyện căn bản nhất, giúp người mới nhập môn cảm ngộ linh khí trời đất.',

    // 9 passive học được khi đột phá vào đúng cảnh giới, chỉ khi tâm
    // pháp này đang trang bị — xem GameManager.syncRealmPassive() và
    // Technique.passiveSkillIdsByRealm. Đây là "cấp skill" (không phải
    // Tâm Pháp tự cộng chỉ số), skill tự có pipeline stat riêng.
    passiveSkillIdsByRealm: {
      qi_refining: 'passive_linh_khi_cam_ung',
      foundation_establishment: 'passive_truc_co_y_chi',
      golden_core: 'passive_kim_dan_chi_quang',
      nascent_soul: 'passive_nguyen_anh_minh_triet',
      soul_transformation: 'passive_hoa_than_chi_uy',
      void_refinement: 'passive_luyen_hu_bo',
      body_integration: 'passive_hop_the_chi_khu',
      mahayana: 'passive_dai_thua_dao_tam',
      tribulation: 'passive_do_kiep_chi_tam',
    },

    // PLAN HOÀN CHỈNH mục 5.1 — Tụ Linh Quyết: Công/Phòng phẳng
    // +15/+25/+35/+70 theo đúng 4 tier, giữ NGUYÊN giá trị doc yêu cầu
    // để tiếp tục balance sau (không tự ý làm tròn/đổi).
    tierEffects: {
      so_nhap: { mightFlat: 15, defenseFlat: 15, hpRegenFlat: 1, mpRegenFlat: 0.5 },
      tieu_thanh: { mightFlat: 25, defenseFlat: 25, hpRegenFlat: 1.5, mpRegenFlat: 0.75 },
      dai_thanh: { mightFlat: 35, defenseFlat: 35, hpRegenFlat: 2, mpRegenFlat: 1.5 },
      vien_man: { mightFlat: 70, defenseFlat: 70, hpRegenFlat: 3, mpRegenFlat: 2 },
    },

    unlocked: false,

    equipped: false,
  },

  // Van Kiem Quyet — Kiem Tu Reimagined (spec 2026-09-15 §7 kept-list):
  // REPURPOSED as the Ngu Kiem Dao signature technique — learned and
  // equipped by the kiem_tu_an conversion node, NOT lootable. Tier
  // effect numbers kept from the orphaned version (content-pass owns
  // the real tuning); the old breakthroughEffect block died earlier.
  {
    id: 'van_kiem_quyet',

    name: 'Vạn Kiếm Quyết',

    icon: '/assets/techniques/van_kiem_quyet.png',

    description:
      'Tâm pháp Ngự Kiếm Đạo — vạn kiếm quy tông, mỗi phi kiếm tự quyết sát chiêu.',

    // HP/s & MP/s mặc định (yêu cầu 2026-08-26) — tâm pháp Elite hồi
    // đều cả hai chỉ số.
    tierEffects: {
      so_nhap: { hpRegenFlat: 1, mpRegenFlat: 1 },
      tieu_thanh: { hpRegenFlat: 2, mpRegenFlat: 2 },
      dai_thanh: { hpRegenFlat: 3, mpRegenFlat: 3 },
      vien_man: { hpRegenFlat: 4, mpRegenFlat: 4 },
    },

    unlocked: false,

    equipped: false,
  },
]
