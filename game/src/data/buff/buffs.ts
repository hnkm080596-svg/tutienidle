import type { BuffDefinition } from '@/core/buff/BuffDefinition'

// Đột Phá Trúc Cơ (Phase 5) — áp lên buff PERSISTENT ngoài trận
// (GameManager.applyPersistentBuff()) khi thất bại Độ Kiếp (mục 13
// spec `breakthrough`) — phạt có cảm giác nhưng không huỷ hoại, KHÔNG
// reset cảnh giới. Xem composables/useTribulation.ts. Khai TRƯỚC mảng
// `buffs` bên dưới vì được tham chiếu lại trong đó.
export const KIEP_THUONG_DEBUFF: BuffDefinition = {
  id: 'kiep_thuong',

  name: 'Kiếp Thương',

  description:
    'Vết thương do Thiên Kiếp để lại sau khi Độ Kiếp thất bại, làm suy giảm toàn thân trong chốc lát.',

  polarity: 'debuff',

  duration: 60,

  stackMode: 'refresh',

  effects: [
    {
      type: 'statModifier',
      stat: 'attack',
      percent: -0.15,
    },

    {
      type: 'statModifier',
      stat: 'defense',
      percent: -0.15,
    },
  ],
}

// Buff/debuff mà skill effect tham chiếu qua buffId (xem
// SkillEffectSystem, data/skill/Skills.ts). Áp lên buff pool riêng
// theo entity trong trận (Battle.playerBuffs/enemyBuffs) — không
// phải buff persistent ngoài trận.
// Kiếm Thế / Kiếm Ý (spec 2026-08-29 mục 5.3): sword_wound (thuộc
// Thái Hư Nhất Kiếm) và phieu_van_bo_buff (thuộc Phiêu Vân Bộ) đã
// dọn CÙNG skill — 2 skill chuyển thành passive node route BK, không
// còn effect nào tham chiếu.
//
// Unified Buff System (Task 7, 2026-09-01) — Ailment/AilmentTemplate
// (data/ailment/ailments.ts, core/ailment/*) hợp nhất vào đúng shape
// `BuffDefinition` này: 'dot'/'cc'/'modifier' category cũ trở thành
// entries trong `effects[]`, onHitChance/onHitAppliesAilmentId trở
// thành 1 effect 'onHitProc' THÊM vào (không phải definition riêng).
// Số liệu port BYTE-FOR-BYTE từ ailments.ts — không đổi balance.
// ailments.ts CHƯA xoá (Task 16 mới xoá, sau khi mọi consumer
// chuyển hẳn sang BuffRegistry).
export const buffs: BuffDefinition[] = [
  KIEP_THUONG_DEBUFF,

  // Pháp Tu (Thổ Tu, 2026-08-15) — Thạch Giáp Trận (special skill,
  // xem data/skill/Skills.ts) tự buff wardMax/thornsPercent tạm thời
  // lên bản thân, tái dùng effect 'buff' có sẵn (zero plumbing mới).
  {
    id: 'thach_giap_buff',

    name: 'Thạch Giáp',

    description:
      'Linh khí Thổ ngưng thành 1 lớp khiên đá tạm thời, tăng Hộ Thuẫn tối đa và khả năng phản đòn.',

    polarity: 'buff',

    duration: 6,

    stackMode: 'refresh',

    effects: [
      {
        type: 'statModifier',

        stat: 'wardMax',

        flat: 40,
      },

      {
        type: 'statModifier',

        stat: 'thornsPercent',

        flat: 0.1,
      },
    ],
  },

  // Thổ Tu ("Độc Thế" reaction, Thổ+Mộc, Plans/EarthPath mục VII,
  // 2026-08-21) — KHÔNG có `duration` (permanent, xem BuffSystem.
  // update()'s `remainingTime === undefined` guard — Buff này KHÔNG tự
  // hết hạn, chỉ tích/giữ nguyên tới hết trận) — port thành
  // `duration: Infinity` (xem BuffSystem.test.ts's "buff gần như vĩnh
  // viễn"). `percent` nhân với `stacks` ở StatCalculator.runPipeline() —
  // đúng "+5%/tầng, tối đa 5 tầng = +25%". Plans/magicpathgeneral Phase
  // 7/8 (2026-08-21) — đổi tên hiển thị "Độc Thế" -> "Độc Căn" (id GIỮ
  // NGUYÊN 'doc_the', xem ElementReaction.ts's `appliesBuffId:
  // 'doc_the'`): plan định nghĩa rõ "Độc Căn" LÀ Reaction Reward Buff
  // cấp cho CASTER khi Mộc+Thổ reaction thành công (buff NÀY, đúng y
  // hệt), còn "Mộc Thế" là Pure Buff riêng của Mộc (xem
  // data/progression/PhapTuNodes.ts's WOOD_TRUC_CO_PURE) — 2 tên trước
  // đây bị đảo ngược. Phase 11 — "+2% HP Recovery từ Poison Damage"/tầng
  // (từng bị hoãn ở EarthPath vì DoT tick chưa resolve được entity
  // NGUỒN) giờ làm thật, xem CombatSystem.applyDotDamage().
  {
    id: 'doc_the',

    name: 'Độc Căn',

    description:
      'Độc trên mục tiêu chuyển hóa thành sức mạnh của bản thân — mỗi tầng tăng Sát Thương Độc + hồi máu từ Trúng Độc, tối đa 5 tầng.',

    polarity: 'buff',

    duration: Infinity,

    maxStacks: 5,

    stackMode: 'stack',

    effects: [
      {
        type: 'statModifier',

        stat: 'ailmentPotencyPercent',

        percent: 0.05,
      },

      {
        type: 'statModifier',

        stat: 'poisonRecoveryPercent',

        percent: 0.02,
      },
    ],
  },

  // Spec 2026-08-30-phap-tu-dao-sac §4 — 2 buff nguồn của 2 reaction
  // sinh mới (Ngưng Lộ Kim+Thủy / Khai Sơn Thổ+Kim), mirror pattern
  // doc_the (stack + refresh, modifiers % hoặc flat).
  {
    id: 'ngung_lo',
    name: 'Ngưng Lộ',
    description: 'Sương ngưng trên thép hóa dòng suối tinh khiết — hồi Pháp Lực nhanh hơn.',
    polarity: 'buff',
    maxStacks: 1,
    stackMode: 'refresh',
    duration: 6,
    effects: [
      {
        type: 'statModifier',
        stat: 'manaRegenPerSecond',
        flat: 5,
      },
    ],
  },
  {
    id: 'khai_son',
    name: 'Khai Sơn',
    description: 'Mỏ kim loại lộ ra từ núi bật gốc — thân thể cứng như quặng.',
    polarity: 'buff',
    maxStacks: 3,
    stackMode: 'stack',
    duration: 6,
    effects: [
      {
        type: 'statModifier',
        stat: 'defense',
        percent: 0.08,
      },
    ],
  },

  // --- Ported from data/ailment/ailments.ts (Task 7, Unified Buff
  // System, 2026-09-01) — field-for-field, no balance changes. ---

  // Pháp Tu Thuần Hệ (spec 2026-09-03 §2.1/§7, N1 đã duyệt) — `bong`
  // ĐỔI refresh → stack max 5, dpsRatio 0.3 → 0.15/tầng: "chồng Thiêu
  // Đốt" của chuỗi Hỏa (A/B/C đắp, D kích nổ ×stack) mới có nghĩa.
  // 1 tầng yếu hơn bản cũ, 5 tầng = 0.75 mạnh hơn. Ảnh hưởng Bạo Viêm/
  // Hỏa Cầu cũ — chấp nhận theo N1 (dev phase, không migration).
  {
    id: 'bong',
    name: 'Bỏng',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'stack',
    maxStacks: 5,
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.15,
        element: 'fire',
      },
    ],
  },

  // Plans/PoisonPath mục 5 (2026-08-21) — chốt số liệu baseline: duration
  // 6->5, dpsRatio 0.15->0.2 ("Poison Damage: 20% Skill Power/tick").
  {
    id: 'trung_doc',
    name: 'Trúng Độc',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'stack',
    maxStacks: 5,
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.2,
        element: 'wood',
      },
    ],
  },

  // Pháp Tu (Kim Tu, 2026-08-15) — element 'metal' (đổi từ 'physical').
  // Plans/KimPath mục 3 (2026-08-21) — maxStacks 3->5.
  {
    id: 'chay_mau',
    name: 'Chảy Máu',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'stack',
    maxStacks: 5,
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.2,
        element: 'metal',
      },
    ],
  },

  {
    id: 'te_cong',
    name: 'Tê Cóng',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'refresh',
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.25,
        element: 'water',
      },
    ],
  },

  {
    id: 'hoai_tu',
    name: 'Hoại Tử',
    polarity: 'debuff',
    duration: 8,
    stackMode: 'stack',
    maxStacks: 4,
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.1,
        element: 'earth',
      },
    ],
  },

  // Thổ Tu — Thạch Hóa: 'modifier' (-30% evasionRate) + on-hit-proc
  // (50% cơ hội áp 'choang' mỗi đòn đánh trúng) — CẢ HAI cùng 1
  // definition, port thành 2 entries trong effects[] (statModifier +
  // onHitProc), đúng brief mục Step 3.
  {
    id: 'thach_hoa',
    name: 'Thạch Hóa',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'refresh',
    effects: [
      {
        type: 'statModifier',
        stat: 'evasionRate',
        percent: -0.3,
      },
      {
        type: 'onHitProc',
        chance: 0.5,
        appliesBuffId: 'choang',
      },
    ],
  },

  // Plans/EarthPath mục VI — "Trói Chân": Root.
  {
    id: 'troi_chan',
    name: 'Trói Chân',
    polarity: 'debuff',
    duration: 2.5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'cc',
        ccEffect: 'root',
      },
    ],
  },

  // Plans/EarthPath mục V — "Dung Nham".
  {
    id: 'dung_nham',
    name: 'Dung Nham',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'refresh',
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.2,
        element: 'fire',
      },
    ],
  },

  // Plans/KimPath mục 6 (2026-08-21) — "Huyết Độc": hợp nhất Trúng
  // Độc + Chảy Máu.
  {
    id: 'huyet_doc',
    name: 'Huyết Độc',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.3,
        element: 'metal',
      },
    ],
  },

  {
    id: 'choang',
    name: 'Choáng',
    polarity: 'debuff',
    duration: 1.5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'cc',
        ccEffect: 'stun',
      },
    ],
  },

  {
    id: 'dong_bang',
    name: 'Đóng Băng',
    polarity: 'debuff',
    duration: 2,
    stackMode: 'refresh',
    effects: [
      {
        type: 'cc',
        ccEffect: 'freeze',
      },
    ],
  },

  // Pháp Tu (Thủy Tu, 2026-08-15) — giữ Làm Chậm LIÊN TỤC đủ
  // convertsAfterContinuousSeconds thì tự chuyển thành Đóng Băng
  // (convertsToOnMaxStacks cũ -> convertsToId mới).
  {
    id: 'lam_cham',
    name: 'Làm Chậm',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'refresh',
    convertsToId: 'dong_bang',
    convertsAfterContinuousSeconds: 2,
    effects: [
      {
        type: 'statModifier',
        stat: 'attackSpeed',
        percent: -0.3,
      },
      {
        type: 'statModifier',
        stat: 'movementSpeed',
        percent: -0.3,
      },
    ],
  },

  // Hàn Khí (Chill) — STACK tới 5 lần thì tự chuyển thành Đóng Băng.
  {
    id: 'han_khi',
    name: 'Hàn Khí',
    polarity: 'debuff',
    duration: 3,
    stackMode: 'stack',
    maxStacks: 5,
    convertsToId: 'dong_bang',
    effects: [
      {
        type: 'statModifier',
        stat: 'attackSpeed',
        percent: -0.06,
      },
      {
        type: 'statModifier',
        stat: 'movementSpeed',
        percent: -0.06,
      },
    ],
  },

  // Cuồng Bạo (Haste).
  {
    id: 'cuong_bao',
    name: 'Cuồng Bạo',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'statModifier',
        stat: 'attackSpeed',
        percent: 0.25,
      },
      {
        type: 'statModifier',
        stat: 'movementSpeed',
        percent: 0.15,
      },
    ],
  },

  // Suy Nhược (Frailty) — debuff phòng ngự.
  {
    id: 'suy_nhuoc',
    name: 'Suy Nhược',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'statModifier',
        stat: 'defense',
        percent: -0.25,
      },
    ],
  },

  // Uy Áp (Dread) — debuff sát thương gây ra.
  {
    id: 'uy_ap',
    name: 'Uy Áp',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'statModifier',
        stat: 'attack',
        percent: -0.2,
      },
    ],
  },

  // Giáp Rạn (Pháp Tu Kim Tu, 2026-08-15) — trừ THẲNG metalResistance
  // (flat, không phải percent).
  {
    id: 'giap_ran',
    name: 'Giáp Rạn',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'refresh',
    effects: [
      {
        type: 'statModifier',
        stat: 'metalResistance',
        flat: -15,
      },
    ],
  },

  // Vạn Kiếm Vũ (Kiếm Tu, 2026-08-15) — "mưa kiếm 9 giây toàn màn hình,
  // bỏ qua 10%-90% giáp/kháng theo cảnh giới" — armorIgnorePercentByRealm
  // ported verbatim (xem BuffSystem.calculateDamagePerSecond()).
  {
    id: 'van_kiem_vu',
    name: 'Vạn Kiếm Vũ',
    polarity: 'debuff',
    duration: 9,
    stackMode: 'refresh',
    effects: [
      {
        type: 'dot',
        dpsRatio: 2,
        element: 'metal',
        armorIgnorePercentByRealm: true,
      },
    ],
  },

  // Kiếm Trận on-hit (spec 2026-08-29 mục 4, BattleSystem.dispatchOnHitEffect
  // 'khiem_phong_haste'/'phan_kich_dodge'/'pha_giap_pen'/'quang_crit'/
  // 'than_ngu_hanh' cases) — 5 self-buff, stack vô hạn tạm trong trận
  // (duration Infinity, tự mất khi BuffPool per-battle bị vứt lúc trận kết
  // thúc), mỗi tầng +2% vào đúng 1 stat. Id khớp `onhit_${kind}` mà
  // BattleSystem tra registry.
  {
    id: 'onhit_khiem_phong_haste',
    name: 'On-hit Khiêm Phong Haste',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'attackSpeed', percent: 0.02 }],
  },
  {
    id: 'onhit_phan_kich_dodge',
    name: 'On-hit Phản Kích Dodge',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'evasionRate', percent: 0.02 }],
  },
  {
    id: 'onhit_pha_giap_pen',
    name: 'On-hit Phá Giáp Pen',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'metalPenetration', percent: 0.02 }],
  },
  {
    id: 'onhit_quang_crit',
    name: 'On-hit Quang Crit',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'criticalRate', percent: 0.02 }],
  },
  {
    id: 'onhit_than_ngu_hanh',
    name: 'On-hit Thần Ngũ Hành',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'metalPower', percent: 0.02 }],
  },

  // ==================================================================
  // Pháp Tu Thuần Hệ (spec 2026-09-03 §7) — buff mới của 5 chuỗi Thuần.
  // Ailment chuỗi TÁI DÙNG engine cũ (bong/te_cong/trung_doc/chay_mau/
  // thach_hoa/troi_chan/choang) — buff mới chỉ ở đây, không thêm vào
  // bảng reaction.
  // ==================================================================

  // Thủy C "Thanh Tuyền Dưỡng Linh" — hồi Pháp Lực.
  {
    id: 'thanh_tuyen',
    name: 'Thanh Tuyền',
    description: 'Suối thiêng Thanh Tuyền nuôi linh khí — Pháp Lực hồi nhanh hơn.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'manaRegenPerSecond', flat: 8 },
      { type: 'statModifier', stat: 'manaRegenPercent', percent: 0.1 },
    ],
  },

  // Biến thể Thủy C2 "Dưỡng Linh · Băng Giáp" — Thủy phòng thủ.
  {
    id: 'bang_giap',
    name: 'Băng Giáp',
    description: 'Giáp băng kết tụ — khiên bền hơn, hồi khiên nhanh hơn.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'wardMax', flat: 50 },
      { type: 'statModifier', stat: 'wardRegenPerSecond', flat: 5 },
    ],
  },

  // Thủy D "Hồi Lưu Thôn Nộ" — tự buff hấp thụ (leech). leechPercent
  // không áp cho true damage Detonate (N7) — Thủy không có Detonate nên OK.
  {
    id: 'hoi_luu',
    name: 'Hồi Lưu',
    description: 'Vòng nước hồi lưu cuốn sinh lực về bản thân — đòn đánh hút máu.',
    polarity: 'buff',
    duration: 4,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'leechPercent', flat: 0.2 }],
  },

  // Biến thể Mộc C1 "Căn Trì · Cấm Bộ" — root BẢN DÀI của troi_chan
  // (2.5s → 4s), chỉ dùng cho biến thể này.
  {
    id: 'cau_mang_can',
    name: 'Câu Mang Căn',
    description: 'Rễ Câu Mang quấn chặt — không thể di chuyển.',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'refresh',
    effects: [{ type: 'cc', ccEffect: 'root' }],
  },

  // Kim B "Thu Giáp Kim Thân" — tự hoá thép, phản đòn.
  {
    id: 'kim_giap',
    name: 'Kim Giáp',
    description: 'Thép Nhục Thu bọc thân — phòng ngự và phản đòn cùng tăng.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'defense', percent: 0.15 },
      { type: 'statModifier', stat: 'thornsPercent', flat: 0.15 },
    ],
  },

  // Thổ C "Địa Trụ Thừa Thiên" — cột đất đỡ đòn.
  {
    id: 'dia_tru',
    name: 'Địa Trụ',
    description: 'Cột đất thiêng chống trời — khiên dày, hồi khiên, phản đòn.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'wardMax', flat: 60 },
      { type: 'statModifier', stat: 'wardRegenPerSecond', flat: 6 },
      { type: 'statModifier', stat: 'thornsPercent', flat: 0.1 },
    ],
  },

  // Ult Thổ "Hậu Thổ Thành Lũy" — +6% defense/tầng, tầng = số địch bị
  // nhốt (stacksPerAffectedTarget E-2), max 8.
  {
    id: 'thanh_luy',
    name: 'Thành Lũy',
    description: 'Thành đất Hậu Thổ vây quanh — mỗi địch bị nhốt thêm 6% phòng thủ.',
    polarity: 'buff',
    duration: 8,
    stackMode: 'stack',
    maxStacks: 8,
    effects: [{ type: 'statModifier', stat: 'defense', percent: 0.06 }],
  },

  // Node Thế Mãn (spec §4/E-7) — engine ÁP/GỠ theo trạng thái Thế đầy
  // (TheResourceSystem.updateTheManBuff / UltimateSystem trigger reset).
  // duration Infinity: buff KHÔNG tự hết hạn; id phải khớp chính xác
  // theManBuffId(element) = `the_man_<element>` (TheResourceSystem.ts).
  {
    id: 'the_man_fire',
    name: 'Thế Mãn (Hỏa)',
    description: 'Hỏa Thế tràn đầy — Thiêu Đốt lan potency mạnh hơn.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'ailmentPotencyPercent', percent: 0.15 }],
  },
  {
    id: 'the_man_water',
    name: 'Thế Mãn (Thủy)',
    description: 'Thủy Thế tràn đầy — Pháp Lực tuôn trào.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'manaRegenPerSecond', flat: 6 }],
  },
  {
    id: 'the_man_wood',
    name: 'Thế Mãn (Mộc)',
    description: 'Mộc Thế tràn đầy — độc tố bám lâu hơn.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'ailmentDurationPercent', percent: 0.2 }],
  },
  {
    id: 'the_man_metal',
    name: 'Thế Mãn (Kim)',
    description: 'Kim Thế tràn đầy — sát khí bén hơn, chí mạng cao hơn.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'criticalRate', percent: 0.08 }],
  },
  {
    id: 'the_man_earth',
    name: 'Thế Mãn (Thổ)',
    description: 'Thổ Thế tràn đầy — thân thể vững như núi.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'defense', percent: 0.1 }],
  },
]
