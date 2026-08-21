import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// Pháp Tu Redesign (magicpath, 2026-08-18) — Node Tree thật ĐẦU TIÊN
// cho Ngũ Hành (1 Active Skill/hành, staged Luyện Khí→Trúc Cơ) kể từ
// 2026-08-21 — Hỏa (Plans/magicpathgeneral + Plans/FirePath), Thủy
// (Plans/waterpath), Mộc (Plans/PoisonPath), Thổ (Plans/EarthPath) và
// Kim (Plans/KimPath, cùng ngày).
//
// Skill tree redesign (2026-08-21, user spec "PHÁP TU — CẤU TRÚC CÂY
// KỸ NĂNG") — Starter Skill KHÔNG phải 1 hệ thống auto-grant tách biệt
// khỏi Node Tree. Nó CHÍNH LÀ root node của skill tree hành đó: mua
// node gốc = học skill khởi đầu của hành, mọi node khác (Luyện Khí +
// Trúc Cơ) đều là con cháu (prerequisite trỏ về node gốc), branch ra
// từ đó. Mỗi hành đúng 1 node gốc — HỎA (hoa_linh_ngo, cost 0, tự mua
// qua GameManager.chooseCultivationPath()'s PHAP_TU_STARTER_NODE_ID),
// THỦY/MỘC/THỔ/KIM (WATER_LINH_NGO/WOOD_LINH_NGO/EARTH_LINH_NGO/
// METAL_LINH_NGO, cost 2 Skill Point, người chơi tự mua). `name`/
// `description` của node gốc là TÊN SKILL THẬT (vd "Thủy Tiễn Thuật"),
// không hiển thị "Lĩnh Ngộ X" nữa — const vẫn giữ hậu tố _LINH_NGO chỉ
// vì lý do nội bộ (không đổi id, tránh vỡ purchasedNodeIds đã lưu).

// FirePath.md mục 5 — 2 Major Trúc Cơ loại trừ nhau (Reaction XOR
// Pure), xem NodePrerequisite's 'excludesNode'.
const FIRE_TRUC_CO_REACTION = 'hoa_truc_co_dan_hoa'
const FIRE_TRUC_CO_PURE = 'hoa_truc_co_tu_hoa'

// waterpath mục VI/XIV — cùng cấu trúc loại trừ nhau với Hỏa.
const WATER_TRUC_CO_REACTION = 'thuy_truc_co_dan_luu'
const WATER_TRUC_CO_PURE = 'thuy_truc_co_tu_thuy'

// PoisonPath.md mục 2/11 — cùng cấu trúc loại trừ nhau với Hỏa/Thủy.
const WOOD_TRUC_CO_REACTION = 'moc_truc_co_doc_dan'
const WOOD_TRUC_CO_PURE = 'moc_truc_co_doc_can'

// EarthPath.md mục XII — cùng cấu trúc loại trừ nhau (Reaction "Định
// Thổ" XOR Pure "Thổ Thế").
const EARTH_TRUC_CO_REACTION = 'tho_truc_co_dinh_tho'
const EARTH_TRUC_CO_PURE = 'tho_truc_co_tho_the'

// KimPath.md mục 14 — cùng cấu trúc loại trừ nhau (Reaction "Huyết
// Dẫn" XOR Pure "Kim Thế").
const METAL_TRUC_CO_REACTION = 'kim_truc_co_huyet_dan'
const METAL_TRUC_CO_PURE = 'kim_truc_co_kim_the'

// Feedback (2026-08-21) — CHỈ Hỏa Cầu Thuật học sẵn miễn phí lúc chọn
// path (xem GameManager.chooseCultivationPath()'s PHAP_TU_STARTER_
// BASIC_SKILL_IDS, giờ chỉ còn đúng 1 skill). Thủy/Mộc/Thổ/Kim đưa trở
// lại mô hình "Lĩnh Ngộ" — 1 node gốc tốn 2 Skill Point (unlocksSkillIds),
// LÀM PREREQUISITE cho MỌI node khác trong hành đó (kể cả Luyện Khí,
// không riêng Trúc Cơ) — chưa học skill thì không mua được gì trong cả
// hành đó. Trúc Cơ minor KHÔNG cần khai thêm field này (đã transitively
// gate qua Trúc Cơ major, bản thân major mới cần).
const WATER_LINH_NGO = 'thuy_linh_ngo'
const WOOD_LINH_NGO = 'moc_linh_ngo'
const EARTH_LINH_NGO = 'tho_linh_ngo'
const METAL_LINH_NGO = 'kim_linh_ngo'

// Hỏa dùng ĐÚNG khuôn root node như 4 hành kia (xem comment đầu file),
// chỉ khác cost = 0 (free) — GameManager.chooseCultivationPath() tự
// mua node này ngay khi chọn path, xem PHAP_TU_STARTER_NODE_ID.
const FIRE_LINH_NGO = 'hoa_linh_ngo'

export const PHAP_TU_NODES: ProgressionNode[] = [
  // ═══════════════════ HỎA (Plans/FirePath, 2026-08-21) ═══════════════════
  // Hỏa Cầu Thuật là ROOT NODE của Hỏa skill tree (xem comment đầu
  // file) — cost 0, GameManager.chooseCultivationPath() tự mua ngay
  // khi chọn path nên người chơi luôn có skill này sẵn để đánh, nhưng
  // về mặt cấu trúc nó vẫn là 1 node THẬT trong cây, y hệt 4 hành kia
  // (chỉ khác free). Luyện Khí — 3 Minor (FirePath.md mục 3); Trúc Cơ —
  // 2 Major loại trừ nhau + Minor đi kèm (mục 5-9) — đều là con của
  // node gốc này.
  {
    id: FIRE_LINH_NGO,
    name: 'Hỏa Cầu Thuật',
    description: 'Học Hỏa Cầu Thuật — root của Hỏa skill tree, luôn có sẵn miễn phí lúc chọn Pháp Tu.',
    type: 'major',
    cost: 0,
    effect: {
      unlocksSkillIds: ['hoa_cau_thuat'],
    },
    branchTag: 'fire',
  },
  {
    id: 'minor_fire_intensity',
    name: 'Hỏa Linh',
    description: '+3% Hỏa Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: FIRE_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_fire_intensity:firePower', sourceId: 'minor_fire_intensity', sourceType: 'talent', stat: 'firePower', percent: 0.03 },
      ],
    },
    branchTag: 'fire',
  },
  {
    id: 'minor_fire_burn',
    name: 'Xích Viêm',
    description: '+5% Sát Thương Thiêu Đốt.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: FIRE_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_fire_burn:ailmentPotencyPercent', sourceId: 'minor_fire_burn', sourceType: 'talent', stat: 'ailmentPotencyPercent', flat: 0.05 },
      ],
    },
    branchTag: 'fire',
  },
  {
    id: 'minor_fire_haste',
    name: 'Tật Hỏa',
    description: '+5% Tốc Độ Đạn.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: FIRE_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_fire_haste:projectileSpeedPercent', sourceId: 'minor_fire_haste', sourceType: 'talent', stat: 'projectileSpeedPercent', flat: 0.05 },
      ],
    },
    branchTag: 'fire',
  },

  // Trúc Cơ — 2 Major loại trừ nhau (FirePath.md mục 5/11: "chỉ cho
  // phép kích hoạt 1 Major Path của Hỏa tại một thời điểm").
  {
    id: FIRE_TRUC_CO_REACTION,
    name: 'Dẫn Hỏa',
    description: '+15% Tỉ Lệ Áp Nguyên Tố (Thiêu Đốt) của Hỏa Cầu Thuật — mở khoá nhánh Minor Reaction.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: FIRE_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: FIRE_TRUC_CO_PURE },
    ],
    // 2026-08-21 — Hỏa Cầu Thuật giờ chỉ 50% base (xem Skills.ts),
    // "+15% Element Application" giờ cộng thật qua elementApplicationPercent
    // (xem SkillEffectSystem.ts's apply(), case 'ailment'). Phần
    // behavior "ưu tiên kiểm tra Reaction trước khi áp mới" (FirePath.
    // md mục 6) vẫn CHƯA có hook riêng — engine hiện đã tự check
    // Reaction NGAY sau mọi lần áp ailment thành công cho MỌI hành
    // (ReactionManager.checkAndTrigger(), không phân biệt node nào
    // mua) — không cần thêm gì để đạt đúng hành vi đó.
    effect: {
      statModifiers: [
        { id: 'node:hoa_truc_co_dan_hoa:elementApplicationPercent', sourceId: FIRE_TRUC_CO_REACTION, sourceType: 'talent', stat: 'elementApplicationPercent', flat: 0.15 },
      ],
    },
    branchTag: 'fire',
  },
  {
    id: FIRE_TRUC_CO_PURE,
    name: 'Tụ Hỏa',
    description: 'Mỗi lần dùng Hỏa Cầu Thuật, tích 1 Hỏa Thế (tối đa 5 tầng, tự giảm theo thời gian nếu ngừng đánh) — mở khoá nhánh Minor Pure, nền tảng cho các Major Pure Hỏa ở Kim Đan trở đi.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: FIRE_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: FIRE_TRUC_CO_REACTION },
    ],
    // FirePath.md mục 7 — Hỏa Thế CHƯA cấp damage ở giai đoạn này
    // ("không vội cho nó +20% damage ngay", để dành Kim Đan), nhưng
    // tài nguyên đã tích/giảm THẬT theo combat (CombatEntity.
    // currentHoaThe, xem BattleSystem.castSkill()/updateHoaThe()) —
    // node này chính là nguồn cấp DUY NHẤT của hoaTheGainPerCast
    // (nền 0 = không mua thì không tích gì cả).
    effect: {
      skillModifiers: [
        { skillId: 'hoa_cau_thuat', statModifiers: [{ stat: 'hoaTheGainPerCast', flat: 1 }] },
      ],
    },
    branchTag: 'fire',
  },

  // Minor Chung — chỉ cần Trúc Cơ, không cần chọn Major nào (FirePath.
  // md mục 8/9's "Minor Chung" nằm giữa trunk và 2 nhánh).
  {
    id: 'minor_fire_heart',
    name: 'Hỏa Tâm',
    description: '+5% Hỏa Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_fire_heart:firePower', sourceId: 'minor_fire_heart', sourceType: 'talent', stat: 'firePower', percent: 0.05 },
      ],
    },
    branchTag: 'fire',
  },
  {
    id: 'minor_fire_application',
    name: 'Hỏa Nguyên',
    description: '+5% Tỉ Lệ Áp Nguyên Tố (Thiêu Đốt).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_fire_application:elementApplicationPercent', sourceId: 'minor_fire_application', sourceType: 'talent', stat: 'elementApplicationPercent', flat: 0.05 },
      ],
    },
    branchTag: 'fire',
  },

  // Minor Reaction — CHỈ mua được sau khi chọn Dẫn Hỏa.
  {
    id: 'minor_fire_reaction_effect',
    name: 'Cộng Minh',
    description: '+5% Sát Thương Phản Ứng Nguyên Tố (Bốc Hơi/Lôi Hỏa/Độc Viêm/Phong Hỏa...).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: FIRE_TRUC_CO_REACTION }],
    effect: {
      statModifiers: [
        { id: 'node:minor_fire_reaction_effect:reactionEffectPercent', sourceId: 'minor_fire_reaction_effect', sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.05 },
      ],
    },
    branchTag: 'fire',
  },

  // Minor Pure — CHỈ mua được sau khi chọn Tụ Hỏa.
  {
    id: 'minor_fire_channeling',
    name: 'Hỏa Mạch',
    description: '+10% Hỏa Thế Tích Được Mỗi Lượt.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: FIRE_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'hoa_cau_thuat', statModifiers: [{ stat: 'hoaTheGainPerCast', percent: 0.1 }] },
      ],
    },
    branchTag: 'fire',
  },
  {
    id: 'minor_fire_retention',
    name: 'Tụ Viêm',
    description: 'Hỏa Thế giảm chậm hơn 10%.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: FIRE_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'hoa_cau_thuat', statModifiers: [{ stat: 'hoaTheDecayReductionPercent', flat: 0.1 }] },
      ],
    },
    branchTag: 'fire',
  },

  // ═══════════════════ MỘC (Plans/PoisonPath, 2026-08-21) ═══════════════════
  // Độc Chưởng là ROOT NODE của Mộc skill tree (xem comment đầu file,
  // WOOD_LINH_NGO, 2 Skill Point, unlocksSkillIds) — node này LÀ
  // prerequisite của MỌI node khác trong hành (Luyện Khí 3 Minor +
  // Trúc Cơ 2 Major loại trừ nhau + Minor đi kèm, mục 5-10). KHÁC Hỏa/
  // Thủy: KHÔNG có Minor Element Application nào (PoisonPath.md mục 1:
  // "không có Element Application Chance" — Độc Chưởng cố định 100%) —
  // "Poison Damage %" tái dùng ailmentPotencyPercent (đã có, cùng stat
  // Xích Viêm/Hấp Tinh Chi Đạo từng dùng) thay vì 1 stat riêng "Mộc"
  // mới; "Poison Duration %" dùng ailmentDurationPercent (MỚI, generic
  // — xem AilmentSystem.apply()).
  {
    id: WOOD_LINH_NGO,
    name: 'Độc Chưởng',
    description: 'Học Độc Chưởng — root của Mộc skill tree, mở khoá toàn bộ Node Tree Mộc (Luyện Khí + Trúc Cơ).',
    type: 'major',
    cost: 2,
    effect: {
      unlocksSkillIds: ['doc_chuong'],
    },
    branchTag: 'wood',
  },
  {
    id: 'minor_wood_intensity',
    name: 'Độc Nguyên',
    description: '+3% Sát Thương Độc.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WOOD_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_wood_intensity:ailmentPotencyPercent', sourceId: 'minor_wood_intensity', sourceType: 'talent', stat: 'ailmentPotencyPercent', flat: 0.03 },
      ],
    },
    branchTag: 'wood',
  },
  {
    id: 'minor_wood_duration',
    name: 'Độc Tức',
    description: '+10% Thời Lượng Trúng Độc.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WOOD_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_wood_duration:ailmentDurationPercent', sourceId: 'minor_wood_duration', sourceType: 'talent', stat: 'ailmentDurationPercent', flat: 0.1 },
      ],
    },
    branchTag: 'wood',
  },
  {
    id: 'minor_wood_potency',
    name: 'Độc Thực',
    description: '+5% Sát Thương Độc.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WOOD_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_wood_potency:ailmentPotencyPercent', sourceId: 'minor_wood_potency', sourceType: 'talent', stat: 'ailmentPotencyPercent', flat: 0.05 },
      ],
    },
    branchTag: 'wood',
  },

  // Trúc Cơ — 2 Major loại trừ nhau (PoisonPath.md mục 2/11: "chỉ chọn
  // 1 Major Path của Mộc").
  {
    id: WOOD_TRUC_CO_REACTION,
    name: 'Độc Dẫn',
    description: '+20% Hiệu Ứng Phản Ứng (Độc Viêm/Độc Thủy...) — mở khoá nhánh Minor Reaction.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: WOOD_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: WOOD_TRUC_CO_PURE },
    ],
    effect: {
      statModifiers: [
        { id: 'node:moc_truc_co_doc_dan:reactionEffectPercent', sourceId: WOOD_TRUC_CO_REACTION, sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.2 },
      ],
    },
    branchTag: 'wood',
  },
  // Plans/magicpathgeneral Phase 7/8 (2026-08-21) — swap tên với buff
  // Reaction Reward của Thổ+Mộc (data/buff/buffs.ts's 'doc_the'): plan
  // định nghĩa "Mộc Thế" = Pure Buff (mechanic NÀY, snapshot lên
  // Ailment), "Độc Căn" = Reaction Reward Buff cấp cho CASTER khi
  // Mộc+Thổ reaction thành công — trước đây 2 tên bị đảo ngược so với
  // đúng semantic. Cơ chế/field/stat bên dưới GIỮ NGUYÊN 100% (chỉ đổi
  // tên hiển thị + mô tả), tránh rebase lại toàn bộ
  // poisonRootPercentPerStack/MaxStacks/save data.
  {
    id: WOOD_TRUC_CO_PURE,
    name: 'Mộc Thế',
    description: 'Trúng Độc tồn tại LIÊN TỤC trên mục tiêu càng lâu càng mạnh — mỗi giây tích 1 tầng Mộc Thế (tối đa 5), mỗi tầng +3% Sát Thương Độc lên đúng mục tiêu đó — mở khoá nhánh Minor Pure.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: WOOD_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: WOOD_TRUC_CO_REACTION },
    ],
    // PoisonPath.md mục 8 — snapshot lên chính Ailment lúc áp, xem
    // AilmentSystem.apply()/update()'s getPoisonRootMultiplier(). Nền 0
    // (chưa mua) = KHÔNG tự mạnh lên theo thời gian, đúng hành vi cũ.
    effect: {
      skillModifiers: [
        {
          skillId: 'doc_chuong',
          statModifiers: [
            { stat: 'poisonRootPercentPerStack', flat: 0.03 },
            { stat: 'poisonRootMaxStacks', flat: 5 },
          ],
        },
      ],
    },
    branchTag: 'wood',
  },

  // Minor Chung — chỉ cần Trúc Cơ, không cần chọn Major nào.
  {
    id: 'minor_wood_heart',
    name: 'Độc Linh',
    description: '+5% Sát Thương Độc.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_wood_heart:ailmentPotencyPercent', sourceId: 'minor_wood_heart', sourceType: 'talent', stat: 'ailmentPotencyPercent', flat: 0.05 },
      ],
    },
    branchTag: 'wood',
  },
  {
    id: 'minor_wood_duration_chung',
    // "Độc Trường" — tách tên khỏi "Độc Tức" (Luyện Khí) dù
    // PoisonPath.md mục 10 dùng lại đúng tên đó, tránh 2 node trùng
    // display name.
    name: 'Độc Trường',
    description: '+10% Thời Lượng Trúng Độc.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_wood_duration_chung:ailmentDurationPercent', sourceId: 'minor_wood_duration_chung', sourceType: 'talent', stat: 'ailmentDurationPercent', flat: 0.1 },
      ],
    },
    branchTag: 'wood',
  },

  // Minor Reaction — CHỈ mua được sau khi chọn Độc Dẫn. Tên "Cộng Độc"
  // (không phải "Độc Dẫn" như PoisonPath.md mục 10 — trùng tên Major).
  {
    id: 'minor_wood_reaction_effect',
    name: 'Cộng Độc',
    description: '+5% Hiệu Ứng Phản Ứng (Độc Viêm/Độc Thủy...).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WOOD_TRUC_CO_REACTION }],
    effect: {
      statModifiers: [
        { id: 'node:minor_wood_reaction_effect:reactionEffectPercent', sourceId: 'minor_wood_reaction_effect', sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.05 },
      ],
    },
    branchTag: 'wood',
  },

  // Minor Pure — CHỈ mua được sau khi chọn Mộc Thế.
  {
    id: 'minor_wood_channeling',
    // "Độc Uyên" — tách tên khỏi Major "Mộc Thế" (Phase 7/8 swap, xem
    // ghi chú ở node WOOD_TRUC_CO_PURE), tránh 2 node trùng display name.
    name: 'Độc Uyên',
    description: '+1 Trần Mộc Thế.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WOOD_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'doc_chuong', statModifiers: [{ stat: 'poisonRootMaxStacks', flat: 1 }] },
      ],
    },
    branchTag: 'wood',
  },
  {
    id: 'minor_wood_threshold',
    name: 'Độc Mạch',
    description: '+5% Sát Thương Độc khi mục tiêu có từ 3 tầng Mộc Thế trở lên.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WOOD_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'doc_chuong', statModifiers: [{ stat: 'poisonRootThresholdBonusPercent', flat: 0.05 }] },
      ],
    },
    branchTag: 'wood',
  },

  // ═══════════════════ THỦY (Plans/waterpath, 2026-08-21) ═══════════════════
  // Thủy Tiễn Thuật là ROOT NODE của Thủy skill tree (xem comment đầu
  // file, WATER_LINH_NGO, 2 Skill Point, unlocksSkillIds) — LÀ
  // prerequisite của MỌI node khác trong hành (Luyện Khí 3 Minor, mục
  // IV/V + Trúc Cơ 2 Major loại trừ nhau + Minor đi kèm, mục VI-XII).
  {
    id: WATER_LINH_NGO,
    name: 'Thủy Tiễn Thuật',
    description: 'Học Thủy Tiễn Thuật — root của Thủy skill tree, mở khoá toàn bộ Node Tree Thủy (Luyện Khí + Trúc Cơ).',
    type: 'major',
    cost: 2,
    effect: {
      unlocksSkillIds: ['thuy_tien_thuat'],
    },
    branchTag: 'water',
  },
  {
    id: 'minor_water_intensity',
    name: 'Thủy Linh',
    description: '+3% Thủy Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WATER_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_water_intensity:waterPower', sourceId: 'minor_water_intensity', sourceType: 'talent', stat: 'waterPower', percent: 0.03 },
      ],
    },
    branchTag: 'water',
  },
  {
    id: 'minor_water_haste',
    name: 'Thủy Tốc',
    description: '+5% Tốc Độ Đạn.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WATER_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_water_haste:projectileSpeedPercent', sourceId: 'minor_water_haste', sourceType: 'talent', stat: 'projectileSpeedPercent', flat: 0.05 },
      ],
    },
    branchTag: 'water',
  },
  {
    id: 'minor_water_application',
    name: 'Thủy Dẫn',
    description: '+5% Tỉ Lệ Áp Nguyên Tố (Tê Cóng).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WATER_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_water_application:elementApplicationPercent', sourceId: 'minor_water_application', sourceType: 'talent', stat: 'elementApplicationPercent', flat: 0.05 },
      ],
    },
    branchTag: 'water',
  },

  // Trúc Cơ — 2 Major loại trừ nhau (waterpath mục XIV: "chỉ chọn 1
  // Major Path của Thủy").
  {
    id: WATER_TRUC_CO_REACTION,
    name: 'Dẫn Lưu',
    description: '+15% Tỉ Lệ Áp Nguyên Tố của Thủy Tiễn Thuật. Khi Thủy kích hoạt Phản Ứng, gia hạn Tê Cóng trên mục tiêu thêm 1 giây thay vì bị tiêu — mở khoá nhánh Minor Reaction.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: WATER_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: WATER_TRUC_CO_PURE },
    ],
    effect: {
      statModifiers: [
        { id: 'node:thuy_truc_co_dan_luu:elementApplicationPercent', sourceId: WATER_TRUC_CO_REACTION, sourceType: 'talent', stat: 'elementApplicationPercent', flat: 0.15 },
      ],
      skillModifiers: [
        { skillId: 'thuy_tien_thuat', statModifiers: [{ stat: 'waterReactionExtensionSeconds', flat: 1 }] },
      ],
    },
    branchTag: 'water',
  },
  {
    id: WATER_TRUC_CO_PURE,
    name: 'Tụ Thủy',
    description: 'Mở Thủy Thế — giảm thẳng 5% sát thương phải nhận (Defensive Stat tồn tại liên tục, KHÔNG phải resource tích/tiêu) — mở khoá nhánh Minor Pure.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: WATER_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: WATER_TRUC_CO_REACTION },
    ],
    effect: {
      skillModifiers: [
        { skillId: 'thuy_tien_thuat', statModifiers: [{ stat: 'thuyThePercent', flat: 0.05 }] },
      ],
    },
    branchTag: 'water',
  },

  // Minor Chung — chỉ cần Trúc Cơ, không cần chọn Major nào.
  {
    id: 'minor_water_heart',
    name: 'Thủy Nguyên',
    description: '+5% Thủy Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_water_heart:waterPower', sourceId: 'minor_water_heart', sourceType: 'talent', stat: 'waterPower', percent: 0.05 },
      ],
    },
    branchTag: 'water',
  },
  {
    id: 'minor_water_cast_speed',
    name: 'Lưu Tốc',
    description: '+3% Giảm Hồi Chiêu (Cast Speed).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_water_cast_speed:cooldownReduction', sourceId: 'minor_water_cast_speed', sourceType: 'talent', stat: 'cooldownReduction', flat: 0.03 },
      ],
    },
    branchTag: 'water',
  },

  // Minor Reaction — CHỈ mua được sau khi chọn Dẫn Lưu.
  {
    id: 'minor_water_reaction_effect',
    name: 'Cộng Lưu',
    description: '+5% Sát Thương Phản Ứng Nguyên Tố (Bốc Hơi/Độc Thủy...).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WATER_TRUC_CO_REACTION }],
    effect: {
      statModifiers: [
        { id: 'node:minor_water_reaction_effect:reactionEffectPercent', sourceId: 'minor_water_reaction_effect', sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.05 },
      ],
    },
    branchTag: 'water',
  },

  // Minor Pure — CHỈ mua được sau khi chọn Tụ Thủy.
  {
    id: 'minor_water_channeling',
    name: 'Thủy Mạch',
    description: '+2% Thủy Thế.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WATER_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'thuy_tien_thuat', statModifiers: [{ stat: 'thuyThePercent', flat: 0.02 }] },
      ],
    },
    branchTag: 'water',
  },
  {
    id: 'minor_water_softness',
    name: 'Nhu Lưu',
    description: '+2% Thủy Thế.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: WATER_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'thuy_tien_thuat', statModifiers: [{ stat: 'thuyThePercent', flat: 0.02 }] },
      ],
    },
    branchTag: 'water',
  },

  // ═══════════════════ KIM (Plans/KimPath, 2026-08-21) ═══════════════════
  // Điểm Kim Thuật là ROOT NODE của Kim skill tree (xem comment đầu
  // file, METAL_LINH_NGO, 2 Skill Point, unlocksSkillIds) — LÀ
  // prerequisite của MỌI node khác trong hành. GIỐNG Hỏa/Thủy (KHÁC
  // Mộc/Thổ): ailmentChance 40% base +
  // node-upgradeable qua elementApplicationPercent (doc mục 2 "đánh trúng không đảm bảo Xuất
  // Huyết"). Chỉ 9 node (không phải 10) — KimPath.md mục 15's "Chung"
  // liệt kê 3 tên GẦN GIỐNG HỆT mục 17's Luyện Khí (Kim Damage/Bleed
  // Damage/Bleed Application) — coi đó là mô tả LUYỆN KHÍ (đúng ý mục
  // 17), Trúc Cơ Chung chỉ còn 1 node riêng tên khác (Kim Tâm), cùng
  // cách xử lý đã dùng cho Mộc/Thổ's collision tương tự. "Huyết Phá"
  // (Pure minor mục 15, biến Xuất Huyết thành Burst tích lũy) HOÃN —
  // cần 1 mechanic hoàn toàn mới (charge-tới-ngưỡng-rồi-nổ, khác hẳn
  // mọi cơ chế hiện có kể cả Thể Tu's Break), không phải chỉnh số đơn
  // thuần; ship "Huyết Lưu" (variant còn lại) thật thay vì cả 2 giả.
  {
    id: METAL_LINH_NGO,
    name: 'Điểm Kim Thuật',
    description: 'Học Điểm Kim Thuật — root của Kim skill tree, mở khoá toàn bộ Node Tree Kim (Luyện Khí + Trúc Cơ).',
    type: 'major',
    cost: 2,
    effect: {
      unlocksSkillIds: ['diem_kim_thuat'],
    },
    branchTag: 'metal',
  },
  {
    id: 'minor_metal_intensity',
    name: 'Kim Khí',
    description: '+3% Kim Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_metal_intensity:metalPower', sourceId: 'minor_metal_intensity', sourceType: 'talent', stat: 'metalPower', percent: 0.03 },
      ],
    },
    branchTag: 'metal',
  },
  {
    id: 'minor_metal_bleed_damage',
    // "Huyết Ấn" — tách tên khỏi Major "Huyết Dẫn" (KimPath.md mục 15
    // cũng đặt tên minor Reaction là "Huyết Dẫn", trùng Major — xem
    // minor_metal_reaction_effect bên dưới).
    name: 'Huyết Ấn',
    description: '+5% Sát Thương Xuất Huyết.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_LINH_NGO }],
    effect: {
      skillModifiers: [
        { skillId: 'diem_kim_thuat', statModifiers: [{ stat: 'metalAilmentPotencyPercent', flat: 0.05 }] },
      ],
    },
    branchTag: 'metal',
  },
  {
    id: 'minor_metal_application',
    name: 'Điểm Huyệt',
    description: '+5% Tỉ Lệ Áp Nguyên Tố (Xuất Huyết).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_metal_application:elementApplicationPercent', sourceId: 'minor_metal_application', sourceType: 'talent', stat: 'elementApplicationPercent', flat: 0.05 },
      ],
    },
    branchTag: 'metal',
  },

  // Trúc Cơ — 2 Major loại trừ nhau (KimPath.md mục 14: "chỉ chọn 1
  // Major Path của Kim").
  {
    id: METAL_TRUC_CO_REACTION,
    name: 'Huyết Dẫn',
    description: '+20% Hiệu Ứng Phản Ứng (Thiêu Huyết/Huyết Độc...) — mở khoá nhánh Minor Reaction.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: METAL_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: METAL_TRUC_CO_PURE },
    ],
    effect: {
      statModifiers: [
        { id: 'node:kim_truc_co_huyet_dan:reactionEffectPercent', sourceId: METAL_TRUC_CO_REACTION, sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.2 },
      ],
    },
    branchTag: 'metal',
  },
  {
    id: METAL_TRUC_CO_PURE,
    name: 'Kim Thế',
    description: 'Mỗi lần Điểm Kim Thuật áp THÀNH CÔNG Xuất Huyết, tích 1 Kim Thế (tối đa 5 tầng, mất 1 tầng mỗi 5 giây không proc mới) — mỗi tầng +5% Sát Thương Xuất Huyết — mở khoá nhánh Minor Pure.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: METAL_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: METAL_TRUC_CO_REACTION },
    ],
    // KimPath.md mục 10 — "Xuyên Kháng DoT" (kimTheDotResistancePenetrationPercentPerStack)
    // TỰ NHẬN cần 1 stat "dot_resistance" doc mô tả là "nếu engine sau
    // này có" — CHƯA tồn tại, node vẫn cấp thật (tick) nhưng không
    // consumer nào đọc, honest placeholder giống skillImpactPercent.
    effect: {
      skillModifiers: [
        {
          skillId: 'diem_kim_thuat',
          statModifiers: [
            { stat: 'kimTheGainPerProc', flat: 1 },
            { stat: 'kimTheDotDamagePercentPerStack', flat: 0.05 },
            { stat: 'kimTheDotResistancePenetrationPercentPerStack', flat: 0.03 },
          ],
        },
      ],
    },
    branchTag: 'metal',
  },

  // Minor Chung — chỉ cần Trúc Cơ, không cần chọn Major nào.
  {
    id: 'minor_metal_heart',
    name: 'Kim Tâm',
    description: '+5% Kim Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_metal_heart:metalPower', sourceId: 'minor_metal_heart', sourceType: 'talent', stat: 'metalPower', percent: 0.05 },
      ],
    },
    branchTag: 'metal',
  },

  // Minor Reaction — CHỈ mua được sau khi chọn Huyết Dẫn. Tên "Cộng
  // Huyết" (không phải "Huyết Dẫn" như KimPath.md mục 15 — trùng tên
  // Major).
  {
    id: 'minor_metal_reaction_effect',
    name: 'Cộng Huyết',
    description: '+5% Hiệu Ứng Phản Ứng (Thiêu Huyết/Huyết Độc...).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_TRUC_CO_REACTION }],
    effect: {
      statModifiers: [
        { id: 'node:minor_metal_reaction_effect:reactionEffectPercent', sourceId: 'minor_metal_reaction_effect', sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.05 },
      ],
    },
    branchTag: 'metal',
  },

  // Minor Pure — CHỈ mua được sau khi chọn Kim Thế.
  {
    id: 'minor_metal_channeling',
    // "Kim Uyên" — tách tên khỏi Major "Kim Thế" dù KimPath.md mục 15
    // dùng lại đúng tên đó, tránh 2 node trùng display name.
    name: 'Kim Uyên',
    description: '+1 Trần Kim Thế.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'diem_kim_thuat', statModifiers: [{ stat: 'kimTheMaxStacksBonus', flat: 1 }] },
      ],
    },
    branchTag: 'metal',
  },
  {
    id: 'minor_metal_burst',
    name: 'Huyết Lưu',
    // "+10% Bleed Tick Rate" (KimPath.md mục 13/15) — engine mô hình
    // DoT LIÊN TỤC (damage/giây), không có khái niệm "tick rời rạc" để
    // tăng tần suất riêng biệt khỏi damage/giây (cùng gotcha đã ghi ở
    // "Độc Thủy"/waterpath) — quy về +10% sát thương Xuất Huyết, tương
    // đương hiệu quả DPS.
    description: '+10% Sát Thương Xuất Huyết (Huyết Lưu — tick nhanh hơn, quy đổi sang %DPS).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'diem_kim_thuat', statModifiers: [{ stat: 'metalAilmentPotencyPercent', flat: 0.1 }] },
      ],
    },
    branchTag: 'metal',
  },
  {
    id: 'minor_metal_shatter',
    name: 'Huyết Phá',
    // Plans/magicpathgeneral Phase 13 (2026-08-21) — KimPath.md mục
    // 13/15 từng để hoãn cơ chế "Xuất Huyết tích riêng 1 charge, bùng
    // nổ ở 5 tầng" (khác hẳn Huyết Lưu ở trên, vốn chỉ quy đổi thành
    // %DPS tĩnh) — giờ làm thật qua CombatEntity.currentHuyetPha (xem
    // SkillEffectSystem.ts's apply(), case 'ailment'). huyetPhaBurstDamage
    // 120 là số minh hoạ (cao hơn dải baseDamage Reaction 60-90 vì cần
    // tích đủ 5 charge mới nổ 1 lần, khác Reaction bắn ngay mỗi lần
    // khớp cặp) — cần playtest, không phải số chốt cứng.
    description: 'Xuất Huyết áp thành công tích 1 Huyết Phá (tối đa 5 tầng) — chạm đủ 5 tầng thì tiêu hết, bùng nổ 1 cục sát thương lên mục tiêu.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: METAL_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        {
          skillId: 'diem_kim_thuat',
          statModifiers: [
            { stat: 'huyetPhaGainPerProc', flat: 1 },
            { stat: 'huyetPhaBurstDamage', flat: 120 },
          ],
        },
      ],
    },
    branchTag: 'metal',
  },

  // ═══════════════════ THỔ (Plans/EarthPath, 2026-08-21) ═══════════════════
  // Thổ Cầu Thuật là ROOT NODE của Thổ skill tree (xem comment đầu
  // file, EARTH_LINH_NGO, 2 Skill Point, unlocksSkillIds) — LÀ
  // prerequisite của MỌI node khác trong hành. KHÁC 3 hành kia: chỉ 9
  // (+1 root = 10) node — EarthPath.md mục XVII chỉ cho đúng 4 Minor
  // Trúc Cơ (2 Chung + 1 Reaction + 1 Pure), không phải 2+2 như Hỏa/
  // Thủy/Mộc. Cũng khác 3 hành kia: "Chấn Vực" (+AOE Radius) đặt dưới
  // Pure thay vì Chung như văn bản mục XVII ghi — theo đúng sơ đồ cây
  // ở mục XVIII (mâu thuẫn nội bộ giữa bảng chữ và sơ đồ trong chính
  // doc, chọn sơ đồ vì tránh 1 "dead node" hoàn toàn vô dụng nếu người
  // chơi chọn Reaction Path thay vì Pure).
  {
    id: EARTH_LINH_NGO,
    name: 'Thổ Cầu Thuật',
    description: 'Học Thổ Cầu Thuật — root của Thổ skill tree, mở khoá toàn bộ Node Tree Thổ (Luyện Khí + Trúc Cơ).',
    type: 'major',
    cost: 2,
    effect: {
      unlocksSkillIds: ['tho_cau_thuat'],
    },
    branchTag: 'earth',
  },
  {
    id: 'minor_earth_intensity',
    name: 'Thổ Nguyên',
    description: '+3% Thổ Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: EARTH_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_earth_intensity:earthPower', sourceId: 'minor_earth_intensity', sourceType: 'talent', stat: 'earthPower', percent: 0.03 },
      ],
    },
    branchTag: 'earth',
  },
  {
    id: 'minor_earth_haste',
    name: 'Thổ Tốc',
    description: '+5% Tốc Độ Đạn.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: EARTH_LINH_NGO }],
    effect: {
      statModifiers: [
        { id: 'node:minor_earth_haste:projectileSpeedPercent', sourceId: 'minor_earth_haste', sourceType: 'talent', stat: 'projectileSpeedPercent', flat: 0.05 },
      ],
    },
    branchTag: 'earth',
  },
  {
    id: 'minor_earth_impact',
    name: 'Chấn Lực',
    description: '+5% Chấn Lực Kỹ Năng (stat nền dự phòng cho các cơ chế Thổ Tu tương lai — EarthPath.md mục XI, chưa có hiệu ứng ở bản này).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: EARTH_LINH_NGO }],
    effect: {
      skillModifiers: [
        { skillId: 'tho_cau_thuat', statModifiers: [{ stat: 'skillImpactPercent', flat: 0.05 }] },
      ],
    },
    branchTag: 'earth',
  },

  // Trúc Cơ — 2 Major loại trừ nhau (EarthPath.md mục XII: "chỉ chọn 1
  // Major Path của Thổ").
  {
    id: EARTH_TRUC_CO_REACTION,
    name: 'Định Thổ',
    description: '+20% Hiệu Ứng Phản Ứng (Dung Nham/Trói Chân/Độc Thế...) — mở khoá nhánh Minor Reaction.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: EARTH_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: EARTH_TRUC_CO_PURE },
    ],
    effect: {
      statModifiers: [
        { id: 'node:tho_truc_co_dinh_tho:reactionEffectPercent', sourceId: EARTH_TRUC_CO_REACTION, sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.2 },
      ],
    },
    branchTag: 'earth',
  },
  {
    id: EARTH_TRUC_CO_PURE,
    name: 'Thổ Thế',
    description: 'Thổ Cầu Thuật biến thành AOE + Knockback thật (mục tiêu chính 100% damage, mục tiêu phụ 70%), đồng thời mỗi lần thi triển tích 1 Thổ Thế (tối đa 5 tầng, chưa cấp hiệu ứng riêng) — mở khoá nhánh Minor Pure.',
    type: 'major',
    cost: 2,
    prerequisites: [
      { kind: 'node', nodeId: EARTH_LINH_NGO },
      { kind: 'realm', realmId: 'foundation' },
      { kind: 'excludesNode', nodeId: EARTH_TRUC_CO_REACTION },
    ],
    // EarthPath.md mục XVI — số liệu minh hoạ cho earthAoeRadius (50)/
    // earthKnockbackDistance (30) là ước lượng của tôi (doc không chốt
    // con số cụ thể, chỉ nói "~1.5× vùng va chạm cơ bản" và "Có" cho
    // Knockback) — earthAoeSecondaryDamagePercent 0.7 là số CHỐT CỨNG
    // từ doc ("Secondary Targets: 70% damage").
    effect: {
      skillModifiers: [
        {
          skillId: 'tho_cau_thuat',
          statModifiers: [
            { stat: 'earthAoeRadius', flat: 50 },
            { stat: 'earthAoeSecondaryDamagePercent', flat: 0.7 },
            { stat: 'earthKnockbackDistance', flat: 30 },
            { stat: 'thoTheGainPerCast', flat: 1 },
          ],
        },
      ],
    },
    branchTag: 'earth',
  },

  // Minor Chung — chỉ cần Trúc Cơ, không cần chọn Major nào.
  {
    id: 'minor_earth_heart',
    name: 'Thổ Tâm',
    description: '+5% Thổ Lực.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'realm', realmId: 'foundation' }],
    effect: {
      statModifiers: [
        { id: 'node:minor_earth_heart:earthPower', sourceId: 'minor_earth_heart', sourceType: 'talent', stat: 'earthPower', percent: 0.05 },
      ],
    },
    branchTag: 'earth',
  },

  // Minor Reaction — CHỈ mua được sau khi chọn Định Thổ.
  {
    id: 'minor_earth_reaction_effect',
    name: 'Định Lực',
    description: '+5% Hiệu Ứng Phản Ứng (Dung Nham/Trói Chân/Độc Thế...).',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: EARTH_TRUC_CO_REACTION }],
    effect: {
      statModifiers: [
        { id: 'node:minor_earth_reaction_effect:reactionEffectPercent', sourceId: 'minor_earth_reaction_effect', sourceType: 'talent', stat: 'reactionEffectPercent', flat: 0.05 },
      ],
    },
    branchTag: 'earth',
  },

  // Minor Pure — CHỈ mua được sau khi chọn Thổ Thế.
  {
    id: 'minor_earth_aoe',
    name: 'Chấn Vực',
    description: '+5% Bán Kính Chấn Địa.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: EARTH_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'tho_cau_thuat', statModifiers: [{ stat: 'earthAoeRadius', percent: 0.05 }] },
      ],
    },
    branchTag: 'earth',
  },
  {
    id: 'minor_earth_knockback',
    name: 'Trọng Thổ',
    description: '+10% Lực Đẩy Lùi.',
    type: 'minor',
    cost: 1,
    prerequisites: [{ kind: 'node', nodeId: EARTH_TRUC_CO_PURE }],
    effect: {
      skillModifiers: [
        { skillId: 'tho_cau_thuat', statModifiers: [{ stat: 'earthKnockbackDistance', percent: 0.1 }] },
      ],
    },
    branchTag: 'earth',
  },
]
