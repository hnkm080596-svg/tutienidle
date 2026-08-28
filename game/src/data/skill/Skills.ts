import type { Skill } from '../../core/skill/Skill'
import { TRAN_SEQUENCE } from '../progression/KiemTuNodes'

// 9 skill Kiếm Trận (chiêu trận) — table-driven từ `TRAN_SEQUENCE`
// (KiemTuNodes.ts, dùng chung với các keystone tương ứng để tránh định
// nghĩa lại chuỗi id/realmId/swordCount lần 2 — Task 5 review fix,
// 2026-08-28). Mỗi trận unlock qua 1 keystone riêng (kiem_tran_luong_nghi
// … kiem_tran_vo_cuc), cadence attack_speed như Huy Kiếm/Ngự Kiếm Thuật.
// swordCount càng lớn thì damage/swordIntentDamageRatio càng cao — "dựa
// vào số Kiếm Ý đang có" cùng công thức Kiếm Khai Thiên Môn. Công thức:
// value = 0.5 + swordCount × 0.1; swordIntentDamageRatio = 0.0002 × swordCount
// (số liệu GIỮ NGUYÊN so với bản hand-written trước review fix — refactor
// thuần cấu trúc, không đổi con số).
const KIEM_TRAN_SKILLS: Skill[] = TRAN_SEQUENCE.map((entry) => ({
  id: entry.skillId,

  name: entry.name,

  description: entry.skillDescription ?? `Bày ${entry.name}, ${entry.swordCount} thanh phi kiếm hợp lực chém liên hoàn.`,

  type: 'active',

  level: 1,

  maxLevel: 10,

  requiredRealmId: entry.realmId,

  cooldown: 1,

  remainingCooldown: 0,

  target: 'all_enemies',

  execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },

  effects: [
    {
      type: 'damage',

      // Round — 0.5 + swordCount*0.1 / 0.0002*swordCount trôi float
      // (vd swordCount=3 → 0.0006000000000000001) nếu không làm tròn về
      // đúng độ chính xác của công thức gốc; giữ NGUYÊN số liệu hand-written
      // trước review fix (không lệch dù chỉ 1e-16).
      value: Math.round((0.5 + entry.swordCount * 0.1) * 10) / 10,

      components: [{ kind: 'element', element: 'metal', ratio: 1 }],

      swordIntentDamageRatio: Math.round(0.0002 * entry.swordCount * 10000) / 10000,

      // Task 8 (2026-08-28) — Kiếm Trận keystone (Tam Tài) spawn 1
      // SwordZone tại target sau khi bắn, xem SkillEffect.grantsSwordZone.
      // CHỈ áp cho kiem_tran_tam_tai — 8 trận còn lại vẫn plain damage.
      ...(entry.skillId === 'kiem_tran_tam_tai'
        ? { grantsSwordZone: true, swordZoneCharges: 3, swordZoneDamageRatio: 0.3 }
        : {}),
    },
  ],

  resourceType: 'none',

  buildTag: 'core',

  unlocked: false,

  equipped: false,
}))

// Skill execution policy rework (plan §8) — MỌI active skill khai
// `execution` tường minh; runtime chỉ đọc field này (không fallback
// isBasicAttack/castTime/path):
// - Trảm + Ngự Kiếm Thuật → 'attack_speed' (cadence theo Attack Speed,
//   không ICD/không CDR/không cast time).
// - 5 skill Pháp Tu có cast time 1.2s giữ nguyên số liệu qua policy
//   'cast_time' (cast time chịu Cast Speed, cooldown chịu CDR).
// - Active còn lại → 'cooldown' với cooldown hiện có.
// - 'attack_speed_cast' chưa gán cho skill nào (chỉ author khi thiết kế
//   cụ thể yêu cầu — plan §8.3).
export const SKILLS: Skill[] = [
  {
    id: 'tram',

    name: 'Huy Kiếm',

    description: 'Một chiêu thức cơ bản, không tốn tài nguyên.',

    type: 'active',

    level: 1,

    maxLevel: 3,

    experience: 0,

    totalExperience: 0,

    cooldown: 1,

    remainingCooldown: 0,

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        value: 1,

        damageType: 'physical',

        skillExperienceRatio: 1 / 18,
      },
    ],

    // Plan §8.3 — baseline bảo toàn hành vi: đòn nhịp theo Attack Speed.
    execution: { kind: 'attack_speed' },

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'thai_hu_nhat_kiem',

    name: 'Thái Hư Nhất Kiếm',

    description: 'Một kiếm phá vạn pháp.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    requiredRealmId: 'qi_refining',

    requiredRealmLevel: 3,

    cooldown: 5,

    remainingCooldown: 0,

    target: 'enemy',

    // Plan §8.3 — active skill không cast time → policy 'cooldown'.
    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'damage',

        value: 3,

        // Demo Skill Element: 20% Physical + 80% Kim — Thái Hư Kiếm
        // hợp Kim hơn về mặt chủ đề (kiếm khí sắc bén).
        components: [
          { kind: 'physical', ratio: 0.2 },
          { kind: 'element', element: 'metal', ratio: 0.8 },
        ],

        // Demo attribute scaling — kiếm khí phần lớn là pháp lực (Kim
        // component chiếm 80%), mỗi điểm Linh Căn cộng thêm 0.3% dame.
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.003 }],
      },

      {
        type: 'debuff',

        buffId: 'sword_wound',

        duration: 5,
      },
    ],
    resourceType: 'none',

    unlocked: false,

    equipped: false,

    // Core Loop Foundation checklist (Mục SKILL) — "behavior-changing
    // node" minh hoạ: 2 lối chơi khác hẳn nhau, không chỉ đổi số.
    specializations: [
      {
        id: 'trong_kiem',

        name: 'Trọng Kiếm',

        description:
          'Bỏ hẳn kiếm khí Kim, dồn toàn lực vào 1 đòn vật lý cực nặng — mất hiệu ứng cộng theo Linh Căn.',

        effectsOverride: [
          {
            type: 'damage',

            value: 5,

            damageType: 'physical',
          },

          {
            type: 'debuff',

            buffId: 'sword_wound',

            duration: 5,
          },
        ],
      },

      {
        id: 'linh_kiem',

        name: 'Linh Kiếm',

        description:
          'Kiếm khí hoá hoàn toàn thành Kim linh lực, hồi 1 phần khí huyết mỗi lần xuất chiêu.',

        effectsOverride: [
          {
            type: 'damage',

            value: 2.5,

            components: [{ kind: 'element', element: 'metal', ratio: 1 }],

            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.005 }],
          },

          {
            type: 'heal',

            value: 10,
          },

          {
            type: 'debuff',

            buffId: 'sword_wound',

            duration: 5,
          },
        ],
      },
    ],
  },

  {
    id: 'phieu_van_bo',

    name: 'Phiêu Vân Bộ',

    description: 'Thân pháp giúp né tránh và ra đòn nhanh hơn trong chốc lát.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 8,

    remainingCooldown: 0,

    target: 'self',

    // Plan §8.3 — active skill không cast time → policy 'cooldown'.
    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'buff',

        buffId: 'phieu_van_bo_buff',

        duration: 4,
      },
    ],
    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'pha_thien_nhat_kich',

    name: 'Phá Thiên Nhất Kích',

    description: 'Chiêu cuối dồn hết thanh nộ vào một đòn đánh chí mạng.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    requiredRealmId: 'foundation_establishment',

    cooldown: 3,

    remainingCooldown: 0,

    cost: 90,

    target: 'enemy',

    // Plan §8.3 — active skill không cast time → policy 'cooldown'.
    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'damage',

        value: 5,

        // Trước dùng 'true' (bỏ qua defense, scale theo attack) — giờ
        // 'true' đã đổi tên 'primordial' VÀ đổi hẳn nguồn scale sang
        // primordialPower riêng (Hỗn Nguyên, mặc định 0). Đây là 1
        // chiêu rage-ultimate thuần võ thuật ("dồn hết thanh nộ"),
        // không mang màu sắc Hỗn Nguyên/Void — giữ 'physical' (scale
        // theo attack như cũ) để không bị nerf oan về gần 0 sát
        // thương do primordialPower trống, thay vì đổi cứng theo tên.
        damageType: 'physical',

        // Demo Adaptive (nhiều attribute trong 1 entry — dùng giá trị
        // CAO NHẤT): đòn dồn sức có thể xuất phát từ Căn Cốt (cường
        // công) hoặc Thân Pháp (khéo léo dồn lực), tuỳ build nào cao hơn.
        attributeScaling: [{ attributes: ['strength', 'dexterity'], ratioPerPoint: 0.004 }],
      },
    ],
    resourceType: 'rage',

    unlocked: false,

    equipped: false,
  },

  // Hỏa Tu (Plans/magicpathgeneral + Plans/FirePath, 2026-08-21) —
  // THAY HẲN kit 3-skill+1-passive cũ (xich_viem_chuong/viem_hai/
  // bao_viem/passive_bao_viem_focus, đã xoá). Framework mới: 1 Active
  // Skill DUY NHẤT mỗi hành (không còn multi-skill kit) — chiều sâu
  // đến từ Node Tree (Minor đổi stat, Major đổi tag/behavior của
  // CHÍNH skill này), xem data/progression/PhapTuNodes.ts. Học SẴN
  // lúc chọn path (GameManager.chooseCultivationPath(), KHÔNG còn qua
  // node "Lĩnh Ngộ Hỏa" — node đó đã gỡ khỏi PhapTuNodes.ts).
  {
    id: 'hoa_cau_thuat',

    name: 'Hỏa Cầu Thuật',

    description: 'Phóng Hỏa Cầu vào mục tiêu, có cơ hội gây Thiêu Đốt.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    remainingCooldown: 0,

    castTime: 1.2,

    // Plan §8.3 — giữ nguyên cast time hiện có qua policy 'cast_time'.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        // FirePath.md mục 2 — "Damage: 100% Skill Power".
        value: 1,

        components: [{ kind: 'element', element: 'fire', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'ailment',

        ailmentId: 'bong',

        // 2026-08-21 — SỬA lại quyết định ban đầu ("100% luôn áp"):
        // Hỏa Cầu Thuật gốc chỉ 50% cơ hội áp Thiêu Đốt, node "Dẫn
        // Hỏa" (+15%) và "Hỏa Nguyên" (+5%) ở Trúc Cơ cộng thêm qua
        // stat elementApplicationPercent (xem SkillEffectSystem.ts,
        // data/progression/PhapTuNodes.ts) — để node đó có ý nghĩa
        // thật thay vì cộng vào con số đã max.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) — skill này là ROOT NODE của
    // Hỏa tree (xem PhapTuNodes.ts), CHIẾM 1 slot Loadout bình thường
    // và chạy qua scheduler auto-cast thống nhất như mọi skill khác.
    // Điểm khác biệt DUY NHẤT của Hỏa Cầu Thuật với 4 hành kia là được
    // tự học + trang bị sẵn (cost 0, xem GameManager.chooseCultivationPath()).

    // Hỏa Tu Pure (Plans/FirePath mục 7) — mỗi lần cast +hoaTheGainPerCast
    // (0 nếu chưa mua "Tụ Hỏa"), xem BattleSystem.castSkill().
    grantsHoaThePerCast: true,

    resourceType: 'none',

    buildTag: 'dot',

    unlocked: false,

    equipped: false,
  },

  // Mộc Tu (Plans/PoisonPath, 2026-08-21) — THAY HẲN kit 3-skill+1-
  // passive cũ (dang_trao/doc_vu/hap_tinh_dai_phap/passive_hap_tinh_tuy,
  // đã xoá). Cùng framework 1-Active-Skill/hành với Hỏa/Thủy — chiều
  // sâu đến từ Node Tree, xem data/progression/PhapTuNodes.ts. Học SẴN
  // lúc chọn path (GameManager.chooseCultivationPath()). KHÁC Hỏa/Thủy:
  // 0 direct damage (chỉ có effect 'ailment', KHÔNG có effect 'damage'
  // nào — PoisonPath.md mục 1 "0 direct damage"), ailmentChance CỐ ĐỊNH
  // 100% — Mộc KHÔNG có Element Application Chance/minor nào chỉnh tỉ
  // lệ này (khác Hỏa Cầu Thuật/Thủy Tiễn Thuật 50% base + node cộng
  // thêm), toàn bộ sát thương đến từ Trúng Độc DoT.
  {
    id: 'doc_chuong',

    name: 'Độc Chưởng',

    description:
      'Vỗ độc chưởng vào mục tiêu, không gây sát thương trực tiếp nhưng luôn áp Trúng Độc.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    remainingCooldown: 0,

    castTime: 1.2,

    // Plan §8.3 — giữ nguyên cast time hiện có qua policy 'cast_time'.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'ailment',

        ailmentId: 'trung_doc',

        ailmentChance: 1,
      },
    ],

    // Skill tree redesign (2026-08-21) — root node của Mộc tree, chiếm
    // 1 slot Loadout bình thường (xem hoa_cau_thuat's ghi chú).
    resourceType: 'none',

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  // Thủy Tu (Plans/waterpath, 2026-08-21) — THAY HẲN kit 3-skill+1-
  // passive cũ (luu_thuy_chuong/han_trieu/tuyet_bang_pha/
  // passive_luu_thuy_man, đã xoá). Cùng framework 1-Active-Skill/hành
  // với Hỏa (xem Skills.ts's ghi chú đầu khối hoa_cau_thuat) — chiều
  // sâu đến từ Node Tree, xem data/progression/PhapTuNodes.ts. Học SẴN
  // lúc chọn path (GameManager.chooseCultivationPath()).
  {
    id: 'thuy_tien_thuat',

    name: 'Thủy Tiễn Thuật',

    description: 'Bắn Thủy Tiễn vào mục tiêu, có cơ hội gây Tê Cóng.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    remainingCooldown: 0,

    castTime: 1.2,

    // Plan §8.3 — giữ nguyên cast time hiện có qua policy 'cast_time'.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        // waterpath mục II — "Damage: 100% Skill Power".
        value: 1,

        components: [{ kind: 'element', element: 'water', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'ailment',

        ailmentId: 'te_cong',

        // 2026-08-21 — cùng quyết định với Hỏa Cầu Thuật (xem ghi chú
        // ở đó): base 50%, KHÔNG luôn luôn áp — Thủy Dẫn (Luyện Khí)
        // và Dẫn Lưu (Trúc Cơ) cộng thêm qua elementApplicationPercent.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) — skill này là ROOT NODE của
    // element tree (xem PhapTuNodes.ts), CHIẾM 1 slot Loadout bình
    // thường và chạy qua scheduler auto-cast thống nhất như mọi skill
    // khác. Điểm khác biệt DUY NHẤT của Hỏa Cầu Thuật với 4 hành kia là
    // được tự học + trang bị sẵn (cost 0, xem GameManager.chooseCultivationPath()).
    resourceType: 'none',

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  // Kim Tu (Plans/KimPath, 2026-08-21) — THAY HẲN kit 3-skill+1-passive
  // cũ (thiet_sa_chuong/sa_vu/thiet_sa_bao/passive_thiet_sa_tich_uy, đã
  // xoá — 'te_dien'/"Lôi Viêm" [bong.te_dien trong ElementReaction.ts]
  // giờ mồ côi, không skill nào áp te_dien nữa, để nguyên như hoai_tu
  // sau đợt Thổ). Cùng framework 1-Active-Skill/hành với Hỏa/Thủy/Mộc/
  // Thổ — chiều sâu đến từ Node Tree, xem data/progression/PhapTuNodes.ts.
  // Học SẴN lúc chọn path. GIỐNG Hỏa/Thủy (KHÁC Mộc/Thổ): ailmentChance
  // 40% base + node-upgradeable qua elementApplicationPercent (doc mục 2:
  // "Đánh trúng không đảm bảo Xuất Huyết — khác Độc Chưởng").
  {
    id: 'diem_kim_thuat',

    name: 'Điểm Kim Thuật',

    description: 'Điểm huyệt bằng khí Kim, có cơ hội gây Xuất Huyết.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    remainingCooldown: 0,

    castTime: 1.2,

    // Plan §8.3 — giữ nguyên cast time hiện có qua policy 'cast_time'.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        value: 1,

        components: [{ kind: 'element', element: 'metal', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'ailment',

        ailmentId: 'chay_mau',

        ailmentChance: 0.4,

        // Kim Tu Trúc Cơ Pure (Plans/KimPath mục 9/11, 2026-08-21) — CHỈ
        // roll THÀNH CÔNG (Xuất Huyết thật sự áp được) mới +Kim Thế, xem
        // SkillEffectSystem.ts's apply(), case 'ailment'. 0 nếu chưa mua
        // Major "Kim Thế" (kimTheGainPerProc nền 0).
        grantsKimThePerProc: true,

        // Plans/magicpathgeneral Phase 13 (2026-08-21) — Huyết Phá,
        // CÙNG điều kiện roll với Kim Thế ở trên, 2 counter độc lập.
        // 0 nếu chưa mua node "Huyết Phá" (huyetPhaGainPerProc nền 0).
        grantsHuyetPhaPerProc: true,
      },
    ],

    // Skill tree redesign (2026-08-21) — root node của Kim tree, chiếm
    // 1 slot Loadout bình thường (xem hoa_cau_thuat's ghi chú).
    resourceType: 'none',

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  // Thổ Tu (Plans/EarthPath, 2026-08-21) — THAY HẲN kit 3-skill+1-
  // passive cũ (ban_thach_quyen/thach_giap_tran/hau_tho_chan/
  // passive_ban_thach_kien_nhan, đã xoá). Cùng framework 1-Active-
  // Skill/hành với Hỏa/Thủy/Mộc — chiều sâu đến từ Node Tree, xem
  // data/progression/PhapTuNodes.ts. Học SẴN lúc chọn path
  // (GameManager.chooseCultivationPath()). ailmentChance CỐ ĐỊNH 100%
  // — Thổ KHÔNG có Earth Application Chance/Petrify Chance/Minor nào
  // chỉnh tỉ lệ này (PoisonPath-style, giống Mộc), khác Hỏa/Thủy's
  // AOE theo grid, mở bằng Pure major. `earthPureAreaBehavior: true` —
  // GHI ĐÈ đơn-mục-tiêu thành AOE+Knockback thật khi mua Major "Thổ
  // Thế" (xem SkillEffectSystem.ts's apply(), case 'damage').
  {
    id: 'tho_cau_thuat',

    name: 'Thổ Cầu Thuật',

    description: 'Bắn một Thổ Cầu vào mục tiêu, luôn gây Thạch Hóa.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    remainingCooldown: 0,

    castTime: 1.2,

    // Plan §8.3 — giữ nguyên cast time hiện có qua policy 'cast_time'.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        value: 1,

        components: [{ kind: 'element', element: 'earth', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],

        earthPureAreaBehavior: true,
      },

      {
        type: 'ailment',

        ailmentId: 'thach_hoa',

        ailmentChance: 1,
      },
    ],

    // Skill tree redesign (2026-08-21) — root node của Thổ tree, chiếm
    // 1 slot Loadout bình thường (xem hoa_cau_thuat's ghi chú).
    resourceType: 'none',

    buildTag: 'core',

    // Thổ Tu Trúc Cơ Pure (Plans/EarthPath mục XV) — 0 nếu chưa mua
    // Major "Thổ Thế" (thoTheGainPerCast nền 0), xem BattleSystem.
    // castSkill().
    grantsThoThePerCast: true,

    unlocked: false,

    equipped: false,
  },

  // Kiếm Tu (2026-08-15) — xem data/technique/Techniques.ts's ghi chú
  // đầu khối ngu_kiem. "Luyện Khí kì chỉ mở đánh thường, Trúc Cơ mở
  // tuyệt kỹ, nộ kỹ tạm thời chưa ra mắt" — áp dụng MỌI path (xem
  // requiredRealmId/unreleased dưới đây VÀ phần "retroactive gate" ở
  // cuối file cho 5 skill special/5 skill ultimate Ngũ Hành).
  {
    id: 'ngu_kiem_thuat',

    name: 'Ngự Kiếm Thuật',

    description:
      'Điều khiển phi kiếm bay lần lượt về phía mục tiêu, số kiếm tăng theo cảnh giới, mỗi kiếm trúng đích dồn thêm Kiếm Ý.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    remainingCooldown: 0,

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        value: 0.6,

        components: [{ kind: 'element', element: 'metal', ratio: 1 }],

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.003 }],

        // "1~9 kiếm bay lần lượt, cảnh giới càng cao càng nhiều" — bắn
        // (realmIndex + 1) missile liên tiếp, xem SkillEffectSystem.ts.
        hitCountByRealm: true,

        // Combat Rework Phase 5 — "phi kiếm xuyên địch": mỗi kiếm xuyên
        // qua 1 mục tiêu, bay tiếp trúng con kế tiếp cùng hàng, đúng
        // tinh thần "Mưa kiếm" (mục 11 plan) thay vì chỉ dồn sát thương
        // vào đúng 1 con; behavior xuyên cũ đã được thay bằng targeting theo grid.
      },
    ],

    // Plan §8.3 — baseline bảo toàn hành vi: nhịp bắn kiếm theo Attack
    // Speed, chiếm slot 0 của kit Kiếm Tu như mọi loadout skill khác.
    execution: { kind: 'attack_speed' },

    resourceType: 'none',

    // Mỗi kiếm ĐÁNH TRÚNG (không tính né) +1 Kiếm Ý chiến đấu — xem
    // BattleSystem.ts's missile-resolve callback.
    grantsSwordIntentPerHit: true,

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'kiem_khai_thien_mon',

    name: 'Kiếm Khai Thiên Môn',

    description:
      'Triệu hồi 1 thanh cự kiếm chém xuyên chiến trường, dựa vào Kiếm Ý hiện có và cảnh giới mà sát thương càng lớn.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 6,

    remainingCooldown: 0,

    // "Trúc Cơ mở tuyệt kỹ" — áp dụng mọi path, xem SkillSystem.canUse().
    requiredRealmId: 'foundation_establishment',

    target: 'all_enemies',

    // Plan §8.3 — active skill không cast time → policy 'cooldown'.
    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'damage',

        value: 2,

        components: [{ kind: 'element', element: 'metal', ratio: 1 }],

        // "dựa vào số Kiếm Ý đang có" — CHỈ ĐỌC, không tiêu, xem
        // SkillEffect.ts's ghi chú.
        swordIntentDamageRatio: 0.0002,

        // "cảnh giới càng cao sát thương càng lớn".
        realmDamageRatio: 0.15,
      },
    ],
    resourceType: 'none',

    buildTag: 'burst',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'van_kiem_trieu_tong',

    name: 'Vạn Kiếm Triều Tông',

    description:
      'Dồn hết 9999 Kiếm Ý, triệu hồi mưa kiếm phủ kín chiến trường trong 9 giây, xuyên phá phần lớn giáp/kháng của toàn bộ kẻ địch.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Kiếm Tu Tự Lực (Task 5, 2026-08-28) — "Trúc Cơ mở tuyệt kỹ" áp dụng
    // đồng bộ mọi ultimate/tuyệt kỹ path (xem Kiếm Khai Thiên Môn ở trên
    // cùng requiredRealmId), skill này trước đây thiếu field này.
    requiredRealmId: 'foundation_establishment',

    cooldown: 20,

    remainingCooldown: 0,

    cost: 9999,

    // "nộ kỹ tạm thời chưa ra mắt" — áp dụng mọi path, chặn cứng bất
    // kể cảnh giới/tài nguyên, xem SkillSystem.canUse().
    unreleased: false,

    target: 'all_enemies',

    // Plan §8.3 — active skill không cast time → policy 'cooldown'.
    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'ailment',

        ailmentId: 'van_kiem_vu',

        ailmentChance: 1,
      },
    ],
    resourceType: 'sword_intent',

    buildTag: 'burst',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'passive_kiem_tam_lanh_liet',

    name: 'Kiếm Tâm Lãnh Liệt',

    description: 'Tâm kiếm lạnh lùng sắc bén, mỗi đòn chí mạng càng thêm phần quyết liệt.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,

    remainingCooldown: 0,

    cost: 0,

    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_kiem_tam_lanh_liet_crit_damage',

        sourceId: 'passive_kiem_tam_lanh_liet',
        sourceType: 'skill',

        stat: 'criticalDamage',

        percent: 0.01,

        stacks: 0,

        maxStacks: 30,
      },
    ],

    passiveTrigger: 'critical',

    buildTag: 'burst',

    unlocked: false,

    equipped: false,
  },

  // Kiếm Tu Tự Lực (Task 5, 2026-08-28, xem
  // .superpowers/sdd/2026-08-28-kiem-tu-tu-luc/task-5-brief.md) —
  // Bạt Kiếm Thuật: TỤ LỰC (execution 'channel', Task 3), mỗi tickSeconds
  // (3-9s, UI slider Task 7) tự nổ 1 phát AOE toàn màn hình, sát thương
  // khuếch đại theo damage-taken tích lũy trong lúc tụ (xem
  // BattleSystem.resolveChannelTick()). Root node bat_kiem_an
  // (KiemTuNodes.ts) unlock skill này, gate bởi skillCastCount Huy Kiếm
  // Lv3 + 9999 lần cast.
  {
    id: 'bat_kiem_thuat',

    name: 'Bạt Kiếm Thuật',

    description: 'Tụ lực kiếm ý, mỗi vài giây quạt một kiếm khí xuyên thiên địa, sát thương toàn màn hình.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 0,

    remainingCooldown: 0,

    target: 'all_enemies',

    execution: { kind: 'channel', tickSeconds: 3 },

    effects: [
      {
        type: 'damage',

        value: 2,

        components: [{ kind: 'element', element: 'metal', ratio: 1 }],

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
    ],

    resourceType: 'none',

    buildTag: 'burst',

    unlocked: false,

    equipped: false,
  },

  // 9 skill Kiếm Trận (chiêu trận) — generated từ KIEM_TRAN_SKILLS (xem
  // định nghĩa + comment công thức ở đầu file, table-driven từ
  // TRAN_SEQUENCE trong KiemTuNodes.ts).
  ...KIEM_TRAN_SKILLS,

  // 9 passive — mỗi cảnh giới mở khóa 1, nguồn map nằm ở tâm pháp tu
  // luyện (xem Technique.passiveSkillIdsByRealm trong
  // data/technique/Techniques.ts và GameManager.syncRealmPassive()).
  // Mỗi cái dùng passiveTrigger khác nhau — không dùng chung 1 điều
  // kiện tích stack.
  {
    id: 'passive_linh_khi_cam_ung',

    name: 'Linh Khí Cảm Ứng',

    description: 'Cảm nhận linh khí xung quanh, mỗi đòn đánh trúng tăng dần công kích.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'qi_refining',

    cooldown: 0,

    remainingCooldown: 0,

    cost: 0,

    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_linh_khi_cam_ung_attack',

        sourceId: 'passive_linh_khi_cam_ung',
        sourceType: 'skill',

        stat: 'attack',

        percent: 0.005,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'hit',

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

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

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

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

    unlocked: false,

    equipped: false,
  },

  {
    id: 'passive_nguyen_anh_minh_triet',

    name: 'Nguyên Anh Minh Triệt',

    // Pháp Tu Redesign (magicpath, 2026-08-18) — cultivationRate đã bị
    // xoá khỏi Stats (tốc độ tu luyện giờ cố định, không ai tăng được
    // nữa), passiveModifiers CŨ của skill này (buff cultivationRate)
    // không còn hợp lệ. TẠM để trống, chưa gán stat mới — xem audit
    // cuối phiên [[tienhiep-phap-tu-magicpath]], cần quyết định lại
    // hướng passive này (đổi sang combat stat, hay bỏ hẳn) khi làm nội
    // dung "class chính thức".
    description:
      'Nguyên Anh thấu triệt — cảm ngộ sâu hơn với thiên địa (hiện chưa có hiệu ứng, đang chờ thiết kế lại).',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'nascent_soul',

    cooldown: 0,

    remainingCooldown: 0,

    cost: 0,

    target: 'self',

    effects: [],

    passiveModifiers: [],

    passiveTrigger: 'per_second',

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_hoa_than_chi_uy_attack',

        sourceId: 'passive_hoa_than_chi_uy',
        sourceType: 'skill',

        stat: 'attack',

        percent: 0.02,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'kill',

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_luyen_hu_bo_attack_speed',

        sourceId: 'passive_luyen_hu_bo',
        sourceType: 'skill',

        stat: 'attackSpeed',

        percent: 0.01,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'cast',

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

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

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_dai_thua_dao_tam_attunement',

        sourceId: 'passive_dai_thua_dao_tam',
        sourceType: 'skill',

        // Trước cộng %magicAttack (stat đã xoá, gộp vào tổng hợp 5
        // hành) — đổi sang Linh Căn (Attunement), khớp thẳng ý nghĩa
        // "đạo tâm viên mãn, pháp lực tăng dần" và tự lan toả đều
        // sang cả 6 hành qua tầng dẫn xuất (xem
        // StatCalculator.deriveAttributeModifiers()).
        stat: 'attunement',

        percent: 0.015,

        stacks: 0,

        maxStacks: 50,
      },
    ],

    passiveTrigger: 'hit',

    unlocked: false,

    equipped: false,
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

    remainingCooldown: 0,

    cost: 0,

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

    unlocked: false,

    equipped: false,
  },

  // Nội tại chiến đấu của Tâm Pháp Chiến Đấu — tự học + equip khi
  // technique tương ứng được trang bị (xem GameManager.equipTechnique()),
  // KHÔNG liên quan tới hệ thống 9 passive theo cảnh giới ở trên.
  {
    id: 'passive_thai_hu_kiem_y',

    name: 'Thái Hư Kiếm Ý',

    description: 'Kiếm ý thấu triệt hư vô, mỗi đòn chí mạng dồn thêm sát khí.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,

    remainingCooldown: 0,

    cost: 0,

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

    unlocked: false,

    equipped: false,
  },

  {
    id: 'passive_kim_cang_y_chi',

    name: 'Kim Cang Ý Chí',

    description: 'Thân thể cứng như kim thạch, mỗi đòn chịu đau càng thêm vững vàng.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,

    remainingCooldown: 0,

    cost: 0,

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

    unlocked: false,

    equipped: false,
  },
]
