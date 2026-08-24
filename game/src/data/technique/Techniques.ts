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

    name: 'Đại Ngũ Hành Chân Quyết',

    icon: '/assets/techniques/dai_ngu_hanh_chan_quyet.png',

    description: 'Cho khả năng cảm ngộ ngũ đại nguyên tố trong tự nhiên — Kim, Mộc, Thủy, Hỏa, Thổ đều có thể dung hợp vào một thân, vận dụng tuỳ ý qua từng chiêu thức.',

    resourceLabel: 'Pháp Lực',

    mpLabel: 'Linh Lực',

    // PLAN HOÀN CHỈNH mục 5.2 — Đại Ngũ Hành: %Linh lực tối đa
    // 3→4→5→10, %Hồi Linh (Increased manaRegenPerSecond, KHÔNG phải %
    // maxMp — xem Technique.ts's TechniqueTierEffect) 0.5→0.75→1.5→2,
    // giá trị Đại Thành đã chốt lại với user (doc gốc ghi nhầm 0.1%).
    tierEffects: {
      so_nhap: { maxMpPercent: 0.03, manaRegenPercent: 0.005 },
      tieu_thanh: { maxMpPercent: 0.04, manaRegenPercent: 0.0075 },
      dai_thanh: { maxMpPercent: 0.05, manaRegenPercent: 0.015 },
      vien_man: { maxMpPercent: 0.1, manaRegenPercent: 0.02 },
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

    description: 'Tâm pháp Kiếm hệ, dạy cách ngự sử phi kiếm vây quanh — kiếm ý ngưng tụ theo từng đòn.',

    combatTypeId: 'crit',

    element: 'metal',

    resourceLabel: 'Kiếm Ý',

    mpLabel: 'Niệm Lực',

    // Kiếm Ý CHIẾN ĐẤU dùng pool riêng (currentSwordIntent), không
    // phải Nộ Khí relabel như Pháp Tu — xem CombatHud.vue.
    usesSwordIntentResource: true,

    // Nội tại chiến đấu — passive_kiem_tam_lanh (xem data/skill/Skills.ts).
    innateSkillId: 'passive_kiem_tam_lanh_liet',

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

    unlocked: false,

    equipped: false,
  },

  {
    id: 'tu_linh_quyet',

    name: 'Tụ Linh Quyết',

    icon: '/assets/techniques/spirit_gathering_scripture.png',

    description: 'Công pháp tu luyện căn bản nhất, giúp người mới nhập môn cảm ngộ linh khí trời đất.',

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
      so_nhap: { attackFlat: 15, defenseFlat: 15 },
      tieu_thanh: { attackFlat: 25, defenseFlat: 25 },
      dai_thanh: { attackFlat: 35, defenseFlat: 35 },
      vien_man: { attackFlat: 70, defenseFlat: 70 },
    },

    unlocked: false,

    equipped: false,
  },

  // Vạn Kiếm Quyết — rớt từ Elite/Boss (data/enemy/Enemies.ts's bandit).
  // TOÀN BỘ giá trị cũ của tâm pháp này (breakthroughEffect: 3
  // attribute + criticalDamage tích luỹ mỗi lần phá cảnh giới) đã mất
  // hiệu lực sau khi bỏ breakthroughEffect — hiện KHÔNG còn tác dụng
  // cơ học nào, chỉ còn tồn tại như 1 tâm pháp có thể trang bị/rớt
  // được. Xem audit cuối phiên: cần quyết định xoá hẳn loot này hay
  // gán lại ý nghĩa mới (vd node/skill riêng) khi làm "class chính thức".
  {
    id: 'van_kiem_quyet',

    name: 'Vạn Kiếm Quyết',

    icon: '/assets/techniques/van_kiem_quyet.png',

    description: 'Tâm pháp hiếm rơi từ Elite — vạn kiếm quy tông, ý chí kiếm đạo không gì lay chuyển.',

    unlocked: false,

    equipped: false,
  },
]
