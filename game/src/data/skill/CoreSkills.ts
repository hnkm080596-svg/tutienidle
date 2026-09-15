import type { Skill } from '../../core/skill/Skill'

// Skill execution policy rework (plan Â§8) â€” Má»ŒI active skill khai
// `execution` tÆ°á»ng minh; runtime chá»‰ Ä‘á»c field nÃ y (khÃ´ng fallback
// isBasicAttack/castTime/path):
// - Tráº£m + Ngá»± Kiáº¿m Thuáº­t â†’ 'attack_speed' (cadence theo Attack Speed,
//   khÃ´ng ICD/khÃ´ng CDR/khÃ´ng cast time).
// - 5 skill PhÃ¡p Tu cÃ³ cast time 1.2s giá»¯ nguyÃªn sá»‘ liá»‡u qua policy
//   'cast_time' (cast time chá»‹u Cast Speed, cooldown chá»‹u CDR).
// - Active cÃ²n láº¡i â†’ 'cooldown' vá»›i cooldown hiá»‡n cÃ³.
// - 'attack_speed_cast' chÆ°a gÃ¡n cho skill nÃ o (chá»‰ author khi thiáº¿t káº¿
//   cá»¥ thá»ƒ yÃªu cáº§u â€” plan Â§8.3).
export const CORE_SKILLS: Skill[] = [
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


    target: 'enemy',

    effects: [],

    triggers: [
      {
        trigger: 'onCast',
        actions: [
          {
            type: 'dealDamage',

            value: 1,

            damageType: 'physical',
          },
        ],
      },
    ],

    // Plan Â§8.3 â€” baseline báº£o toÃ n hÃ nh vi: Ä‘Ã²n nhá»‹p theo Attack Speed.
    execution: { kind: 'attack_speed' },

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  // Phap Tu Reimagined Task 2 — the two mortal-path actives learned
  // alongside tram at character creation. Both level ONLY by cast count
  // (CAST_LEVELING_THRESHOLDS; upgradeSkill rejects them, INV-9).
  // linh_bao Lv3 (10000 casts) is the phap_tu_an ritual gate; its
  // primordial hit "ignores all defenses" like the Hon Nguyen stat.
  {
    id: 'linh_bao',

    name: 'Linh Bạo',

    description: 'Tụ linh khí bùng nổ, bỏ qua mọi phòng thủ.',

    type: 'active',

    level: 1,

    maxLevel: 3,

    experience: 0,

    totalExperience: 0,

    cooldown: 1,

    target: 'enemy',

    effects: [],

    triggers: [
      {
        trigger: 'onCast',
        actions: [
          {
            type: 'dealDamage',

            value: 1,

            damageType: 'primordial',
          },
        ],
      },
    ],

    execution: { kind: 'attack_speed' },

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'huy_quyen',

    name: 'Huy Quyền',

    description: 'Một quyền đơn giản, không tốn tài nguyên.',

    type: 'active',

    level: 1,

    maxLevel: 3,

    experience: 0,

    totalExperience: 0,

    cooldown: 1,

    target: 'enemy',

    effects: [],

    triggers: [
      {
        trigger: 'onCast',
        actions: [
          {
            type: 'dealDamage',

            value: 1,

            damageType: 'physical',
          },
        ],
      },
    ],

    execution: { kind: 'attack_speed' },

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  // ------------------------------------------------------------------
  // Phap Tu An kit (Task 7, phap-tu-reimagined) — DATA SHELLS only:
  // ids, slots, targeting, labels for the ritual grant. Resolution
  // semantics (composite element pick / repeat / multicast) land in the
  // An-resolution task — the payloads below are placeholders.
  // ------------------------------------------------------------------
  {
    id: 'van_phap_tuy_tam',

    name: 'Vạn Pháp Tùy Tâm',

    description: 'Vạn pháp tùy tâm — mỗi đòn hóa thành một nguyên tố bất định.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 1,

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        value: 1,

        damageType: 'primordial',
      },
    ],

    execution: { kind: 'attack_speed' },

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'da_phap_lien_tuyen',

    name: 'Đa Pháp Liên Tuyên',

    description: 'Đa pháp liên tuyên — pháp thuật cơ bản bắn ra liên tiếp nhiều lần.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 4,

    target: 'enemy',

    effects: [],

    execution: { kind: 'cooldown' },

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'ngo_dao_hon_don',

    name: 'Ngộ Đạo Hỗn Độn',

    description: 'Ngộ đạo hỗn độn — pháp thuật cơ bản có thể tự phân chia thành nhiều luồng.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,

    target: 'self',

    effects: [],

    resourceType: 'none',

    unlocked: false,

    equipped: false,
  },

  // Há»a Tu (Plans/magicpathgeneral + Plans/FirePath, 2026-08-21) â€”
  // THAY Háº²N kit 3-skill+1-passive cÅ© (xich_viem_chuong/viem_hai/
  // bao_viem/passive_bao_viem_focus, Ä‘Ã£ xoÃ¡). Framework má»›i: 1 Active
  // Skill DUY NHáº¤T má»—i hÃ nh (khÃ´ng cÃ²n multi-skill kit) â€” chiá»u sÃ¢u
  // Ä‘áº¿n tá»« Node Tree (Minor Ä‘á»•i stat, Major Ä‘á»•i tag/behavior cá»§a
  // CHÃNH skill nÃ y), xem data/progression/PhapTuNodes.ts. Há»c Sáº´N
  // lÃºc chá»n path (GameManager.chooseCultivationPath(), KHÃ”NG cÃ²n qua
  // node "LÄ©nh Ngá»™ Há»a" â€” node Ä‘Ã³ Ä‘Ã£ gá»¡ khá»i PhapTuNodes.ts).
  {
    id: 'hoa_cau_thuat',

    name: 'Hỏa Cầu Thuật',

    description: 'Phóng Hỏa Cầu vào mục tiêu, có cơ hội gây Thiêu Đốt.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan §3.3) — Hỏa (bùng nổ):
    // cast 1.6s / cooldown 4s — đòn chậm mạnh, thay nhịp 1.2/1 cũ.
    cooldown: 4,


    castTime: 1.6,

    // Plan §8.3 — policy 'cast_time' là nguồn sự thật runtime; field
    // castTime trên giữ đồng bộ cho UI/tooltip.
    execution: { kind: 'cast_time', castTime: 1.6 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        // FirePath.md má»¥c 2 â€” "Damage: 100% Skill Power".
        value: 1,

        components: [{ kind: 'element', element: 'fire', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'debuff',

        buffId: 'bong',

        // 2026-08-21 â€” Sá»¬A láº¡i quyáº¿t Ä‘á»‹nh ban Ä‘áº§u ("100% luÃ´n Ã¡p"):
        // Há»a Cáº§u Thuáº­t gá»‘c chá»‰ 50% cÆ¡ há»™i Ã¡p ThiÃªu Äá»‘t, node "Dáº«n
        // Há»a" (+15%) vÃ  "Há»a NguyÃªn" (+5%) á»Ÿ TrÃºc CÆ¡ cá»™ng thÃªm qua
        // stat elementApplicationPercent (xem SkillEffectSystem.ts,
        // data/progression/PhapTuNodes.ts) â€” Ä‘á»ƒ node Ä‘Ã³ cÃ³ Ã½ nghÄ©a
        // tháº­t thay vÃ¬ cá»™ng vÃ o con sá»‘ Ä‘Ã£ max.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) â€” skill nÃ y lÃ  ROOT NODE cá»§a
    // Há»a tree (xem PhapTuNodes.ts), CHIáº¾M 1 slot Loadout bÃ¬nh thÆ°á»ng
    // vÃ  cháº¡y qua scheduler auto-cast thá»‘ng nháº¥t nhÆ° má»i skill khÃ¡c.
    // Äiá»ƒm khÃ¡c biá»‡t DUY NHáº¤T cá»§a Há»a Cáº§u Thuáº­t vá»›i 4 hÃ nh kia lÃ  Ä‘Æ°á»£c
    // tá»± há»c + trang bá»‹ sáºµn (cost 0, xem GameManager.chooseCultivationPath()).

    // Há»a Tu Pure (Plans/FirePath má»¥c 7) â€” má»—i láº§n cast +hoaTheGainPerCast
    // (0 náº¿u chÆ°a mua "Tá»¥ Há»a"), xem BattleSystem.castSkill().
    grantsHoaThePerCast: true,

    resourceType: 'none',

    buildTag: 'burst',

    unlocked: false,

    equipped: false,
  },

  // Ult Kiếm Tu (spec 2026-08-29-kiem-the-kiem-y mục 2/3.4) — 2 ult
  // MANUAL: KHÔNG thuộc loadout scheduler (BattleSystem.skip như channel),
  // kích hoạt qua nút Ult trong CombatControlBar + auto-AI. Unlock bằng
  // node ult riêng (KiemTuNodes.ts) — KHÔNG requiredRealmId vì node đã gate.
  {
    id: 'tru_tien_kiem_tran',

    name: 'Tru Tiên Kiếm Trận',

    description: 'Đốt Kiếm Thế, tru tiên nhất nổ trảm diệt toàn màn, để lại kiếm trận trường tồn mãi đao vùng.',

    type: 'active',

    level: 1,

    maxLevel: 1,

    cooldown: 30,


    target: 'all_enemies',

    // Ult không qua scheduler — execution chỉ mang tính mô tả data.
    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'damage',

        value: 3,

        components: [{ kind: 'element', element: 'metal', ratio: 1 }],

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.008 }],
      },
    ],

    resourceType: 'none',

    buildTag: 'ult',

    unlocked: false,

    equipped: false,
  },

  {
    id: 'kiem_khai_thien_mon',

    name: 'Kiếm Khai Thiên Môn',

    description: 'Đốt toàn bộ Kiếm Ý tụ lực, một kiếm khai thiên, sát thương dư tràn ra toàn màn hình.',

    type: 'active',

    level: 1,

    maxLevel: 1,

    cooldown: 60,


    target: 'enemy',

    execution: { kind: 'cooldown' },

    effects: [
      {
        type: 'damage',

        value: 5,

        components: [{ kind: 'element', element: 'metal', ratio: 1 }],

        // Đốt kiếm ý khuếch đại (đọc currentSwordIntent qua
        // swordIntentDamageRatio pipeline sẵn có — pool kiếm ý tạm của
        // route BK).
        swordIntentDamageRatio: 0.0002,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.006 }],
      },
    ],

    resourceType: 'none',

    buildTag: 'ult',

    unlocked: false,

    equipped: false,
  },

  // Má»™c Tu (Plans/PoisonPath, 2026-08-21) â€” THAY Háº²N kit 3-skill+1-
  // passive cÅ© (dang_trao/doc_vu/hap_tinh_dai_phap/passive_hap_tinh_tuy,
  // Ä‘Ã£ xoÃ¡). CÃ¹ng framework 1-Active-Skill/hÃ nh vá»›i Há»a/Thá»§y â€” chiá»u
  // sÃ¢u Ä‘áº¿n tá»« Node Tree, xem data/progression/PhapTuNodes.ts. Há»c Sáº´N
  // lÃºc chá»n path (GameManager.chooseCultivationPath()). KHÃC Há»a/Thá»§y:
  // 0 direct damage (chá»‰ cÃ³ effect 'ailment', KHÃ”NG cÃ³ effect 'damage'
  // nÃ o â€” PoisonPath.md má»¥c 1 "0 direct damage"), ailmentChance Cá» Äá»ŠNH
  // 100% â€” Má»™c KHÃ”NG cÃ³ Element Application Chance/minor nÃ o chá»‰nh tá»‰
  // lá»‡ nÃ y (khÃ¡c Há»a Cáº§u Thuáº­t/Thá»§y Tiá»…n Thuáº­t 50% base + node cá»™ng
  // thÃªm), toÃ n bá»™ sÃ¡t thÆ°Æ¡ng Ä‘áº¿n tá»« TrÃºng Äá»™c DoT.
  {
    id: 'doc_chuong',

    name: 'Độc Chưởng',

    description:
      'Vỗ độc chưởng vào mục tiêu, không gây sát thương trực tiếp nhưng luôn áp Trúng Độc.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan §3.3) — Mộc (DoT): cast
    // 1.2s / cooldown 2s — áp độc mạnh, nhịp vừa.
    cooldown: 2,


    castTime: 1.2,

    // Plan §8.3 — policy 'cast_time' là nguồn sự thật runtime; field
    // castTime trên giữ đồng bộ cho UI/tooltip.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'debuff',

        buffId: 'trung_doc',

        ailmentChance: 1,
      },
    ],

    // Skill tree redesign (2026-08-21) â€” root node cá»§a Má»™c tree, chiáº¿m
    // 1 slot Loadout bÃ¬nh thÆ°á»ng (xem hoa_cau_thuat's ghi chÃº).
    resourceType: 'none',

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  // Thá»§y Tu (Plans/waterpath, 2026-08-21) â€” THAY Háº²N kit 3-skill+1-
  // passive cÅ© (luu_thuy_chuong/han_trieu/tuyet_bang_pha/
  // passive_luu_thuy_man, Ä‘Ã£ xoÃ¡). CÃ¹ng framework 1-Active-Skill/hÃ nh
  // vá»›i Há»a (xem Skills.ts's ghi chÃº Ä‘áº§u khá»‘i hoa_cau_thuat) â€” chiá»u
  // sÃ¢u Ä‘áº¿n tá»« Node Tree, xem data/progression/PhapTuNodes.ts. Há»c Sáº´N
  // lÃºc chá»n path (GameManager.chooseCultivationPath()).
  {
    id: 'thuy_tien_thuat',

    name: 'Thủy Tiễn Thuật',

    description: 'Bắn Thủy Tiễn vào mục tiêu, có cơ hội gây Tê Cóng.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan §3.3) — Thủy (duy trì):
    // cast 0.9s / cooldown 1s — nhịp nhanh áp ailment.
    cooldown: 1,


    castTime: 0.9,

    // Plan §8.3 — policy 'cast_time' là nguồn sự thật runtime; field
    // castTime trên giữ đồng bộ cho UI/tooltip.
    execution: { kind: 'cast_time', castTime: 0.9 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        // waterpath má»¥c II â€” "Damage: 100% Skill Power".
        value: 1,

        components: [{ kind: 'element', element: 'water', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'debuff',

        buffId: 'te_cong',

        // 2026-08-21 â€” cÃ¹ng quyáº¿t Ä‘á»‹nh vá»›i Há»a Cáº§u Thuáº­t (xem ghi chÃº
        // á»Ÿ Ä‘Ã³): base 50%, KHÃ”NG luÃ´n luÃ´n Ã¡p â€” Thá»§y Dáº«n (Luyá»‡n KhÃ­)
        // vÃ  Dáº«n LÆ°u (TrÃºc CÆ¡) cá»™ng thÃªm qua elementApplicationPercent.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) â€” skill nÃ y lÃ  ROOT NODE cá»§a
    // element tree (xem PhapTuNodes.ts), CHIáº¾M 1 slot Loadout bÃ¬nh
    // thÆ°á»ng vÃ  cháº¡y qua scheduler auto-cast thá»‘ng nháº¥t nhÆ° má»i skill
    // khÃ¡c. Äiá»ƒm khÃ¡c biá»‡t DUY NHáº¤T cá»§a Há»a Cáº§u Thuáº­t vá»›i 4 hÃ nh kia lÃ 
    // Ä‘Æ°á»£c tá»± há»c + trang bá»‹ sáºµn (cost 0, xem GameManager.chooseCultivationPath()).
    resourceType: 'none',

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  // Kim Tu (Plans/KimPath, 2026-08-21) - THAY HAN kit 3-skill+1-passive
  // cu (thiet_sa_chuong/sa_vu/thiet_sa_bao/passive_thiet_sa_tich_uy, da
  // xoa). te_dien/'Loi Viem' [bong.te_dien] da XOA SACH (spec
  // 2026-08-30-phap-tu-dao-sac M5 - ailment mo coi tu dot Kim cu,
  // reaction chet theo). Cung framework 1-Active-Skill/hanh voi Hoa/Thuy/
  // Moc/Tho - chieu sau den tu Node Tree, xem data/progression/PhapTuNodes.ts.
  // Hoc SAN luc chon path. GIONG Hoa/Thuy (KHAC Moc/Tho): ailmentChance
  // 40% base + node-upgradeable qua elementApplicationPercent (doc muc 2:
  // 'Danh trung khong dam bao Xuat Huyet - khac Doc Chuong').
  {
    id: 'diem_kim_thuat',

    name: 'Điểm Kim Thuật',

    description: 'Điểm huyệt bằng khí Kim, có cơ hội gây Xuất Huyết.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan §3.3) — Kim (xuyên): cast
    // 1.0s / cooldown 2.5s — single-target nặng, nhịp nhanh-trung bình.
    cooldown: 2.5,


    castTime: 1.0,

    // Plan §8.3 — policy 'cast_time' là nguồn sự thật runtime; field
    // castTime trên giữ đồng bộ cho UI/tooltip.
    execution: { kind: 'cast_time', castTime: 1.0 },

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
        type: 'debuff',

        buffId: 'chay_mau',

        ailmentChance: 0.4,

        // Kim Tu TrÃºc CÆ¡ Pure (Plans/KimPath má»¥c 9/11, 2026-08-21) â€” CHá»ˆ
        // roll THÃ€NH CÃ”NG (Xuáº¥t Huyáº¿t tháº­t sá»± Ã¡p Ä‘Æ°á»£c) má»›i +Kim Tháº¿, xem
        // SkillEffectSystem.ts's apply(), case 'ailment'. 0 náº¿u chÆ°a mua
        // Major "Kim Tháº¿" (kimTheGainPerProc ná»n 0).
        grantsKimThePerProc: true,

        // Plans/magicpathgeneral Phase 13 (2026-08-21) â€” Huyáº¿t PhÃ¡,
        // CÃ™NG Ä‘iá»u kiá»‡n roll vá»›i Kim Tháº¿ á»Ÿ trÃªn, 2 counter Ä‘á»™c láº­p.
        // 0 náº¿u chÆ°a mua node "Huyáº¿t PhÃ¡" (huyetPhaGainPerProc ná»n 0).
        grantsHuyetPhaPerProc: true,
      },
    ],

    // Skill tree redesign (2026-08-21) â€” root node cá»§a Kim tree, chiáº¿m
    // 1 slot Loadout bÃ¬nh thÆ°á»ng (xem hoa_cau_thuat's ghi chÃº).
    resourceType: 'none',

    buildTag: 'core',

    unlocked: false,

    equipped: false,
  },

  // Thá»• Tu (Plans/EarthPath, 2026-08-21) â€” THAY Háº²N kit 3-skill+1-
  // passive cÅ© (ban_thach_quyen/thach_giap_tran/hau_tho_chan/
  // passive_ban_thach_kien_nhan, Ä‘Ã£ xoÃ¡). CÃ¹ng framework 1-Active-
  // Skill/hÃ nh vá»›i Há»a/Thá»§y/Má»™c â€” chiá»u sÃ¢u Ä‘áº¿n tá»« Node Tree, xem
  // data/progression/PhapTuNodes.ts. Há»c Sáº´N lÃºc chá»n path
  // (GameManager.chooseCultivationPath()). ailmentChance Cá» Äá»ŠNH 100%
  // â€” Thá»• KHÃ”NG cÃ³ Earth Application Chance/Petrify Chance/Minor nÃ o
  // chá»‰nh tá»‰ lá»‡ nÃ y (PoisonPath-style, giá»‘ng Má»™c), khÃ¡c Há»a/Thá»§y's
  // AOE theo grid, má»Ÿ báº±ng Pure major. `earthPureAreaBehavior: true` â€”
  // GHI ÄÃˆ Ä‘Æ¡n-má»¥c-tiÃªu thÃ nh AOE+Knockback tháº­t khi mua Major "Thá»•
  // Tháº¿" (xem SkillEffectSystem.ts's apply(), case 'damage').
  {
    id: 'tho_cau_thuat',

    name: 'Thổ Cầu Thuật',

    description: 'Bắn một Thổ Cầu vào mục tiêu, luôn gây Thạch Hóa.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan §3.3) — Thổ (khống chế):
    // cast 1.4s / cooldown 5s — CC chậm, mạnh về điều khiển.
    cooldown: 5,


    castTime: 1.4,

    // Plan §8.3 — policy 'cast_time' là nguồn sự thật runtime; field
    // castTime trên giữ đồng bộ cho UI/tooltip.
    execution: { kind: 'cast_time', castTime: 1.4 },

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
        type: 'debuff',

        buffId: 'thach_hoa',

        ailmentChance: 1,
      },
    ],

    // Skill tree redesign (2026-08-21) â€” root node cá»§a Thá»• tree, chiáº¿m
    // 1 slot Loadout bÃ¬nh thÆ°á»ng (xem hoa_cau_thuat's ghi chÃº).
    resourceType: 'none',

    buildTag: 'core',

    // Thá»• Tu TrÃºc CÆ¡ Pure (Plans/EarthPath má»¥c XV) â€” 0 náº¿u chÆ°a mua
    // Major "Thá»• Tháº¿" (thoTheGainPerCast ná»n 0), xem BattleSystem.
    // castSkill().
    grantsThoThePerCast: true,

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

  // Kiáº¿m Tu Tá»± Lá»±c (Task 5, 2026-08-28, xem
  // .superpowers/sdd/2026-08-28-kiem-tu-tu-luc/task-5-brief.md) â€”
  // Báº¡t Kiáº¿m Thuáº­t: Tá»¤ Lá»°C (execution 'channel', Task 3), má»—i tickSeconds
  // (3-9s, UI slider Task 7) tá»± ná»• 1 phÃ¡t AOE toÃ n mÃ n hÃ¬nh, sÃ¡t thÆ°Æ¡ng
  // khuáº¿ch Ä‘áº¡i theo damage-taken tÃ­ch lÅ©y trong lÃºc tá»¥ (xem
  // BattleSystem.resolveChannelTick()). Root node bat_kiem_an
  // (KiemTuNodes.ts) unlock skill nÃ y, gate bá»Ÿi skillCastCount Huy Kiáº¿m
  // Lv3 + 9999 láº§n cast.
  {
    id: 'bat_kiem_thuat',

    name: 'Bạt Kiếm Thuật',

    description: 'Tụ lực kiếm ý, mỗi vài giây quạt một kiếm khí xuyên thiên địa, sát thương toàn màn hình.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    cooldown: 0,


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
]
