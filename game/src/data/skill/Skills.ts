import type { Skill } from '../../core/skill/Skill'
import type { ElementType } from '../../core/element/ElementType'
import { TRAN_SEQUENCE } from '../progression/KiemTuNodes'

// 9 skill Kiáº¿m Tráº­n (chiÃªu tráº­n) â€” table-driven tá»« `TRAN_SEQUENCE`
// (KiemTuNodes.ts, dÃ¹ng chung vá»›i cÃ¡c keystone tÆ°Æ¡ng á»©ng Ä‘á»ƒ trÃ¡nh Ä‘á»‹nh
// nghÄ©a láº¡i chuá»—i id/realmId/swordCount láº§n 2 â€” Task 5 review fix,
// 2026-08-28). Má»—i tráº­n unlock qua 1 keystone riÃªng (kiem_tran_luong_nghi
// â€¦ kiem_tran_vo_cuc), cadence attack_speed nhÆ° Huy Kiáº¿m/Ngá»± Kiáº¿m Thuáº­t.
// swordCount cÃ ng lá»›n thÃ¬ damage/swordIntentDamageRatio cÃ ng cao â€” "dá»±a
// vÃ o sá»‘ Kiáº¿m Ã Ä‘ang cÃ³" cÃ¹ng cÃ´ng thá»©c Kiáº¿m Khai ThiÃªn MÃ´n. CÃ´ng thá»©c:
// value = 0.5 + swordCount Ã— 0.1; swordIntentDamageRatio = 0.0002 Ã— swordCount
// (sá»‘ liá»‡u GIá»® NGUYÃŠN so vá»›i báº£n hand-written trÆ°á»›c review fix â€” refactor
// thuáº§n cáº¥u trÃºc, khÃ´ng Ä‘á»•i con sá»‘).
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

      // Round â€” 0.5 + swordCount*0.1 / 0.0002*swordCount trÃ´i float
      // (vd swordCount=3 â†’ 0.0006000000000000001) náº¿u khÃ´ng lÃ m trÃ²n vá»
      // Ä‘Ãºng Ä‘á»™ chÃ­nh xÃ¡c cá»§a cÃ´ng thá»©c gá»‘c; giá»¯ NGUYÃŠN sá»‘ liá»‡u hand-written
      // trÆ°á»›c review fix (khÃ´ng lá»‡ch dÃ¹ chá»‰ 1e-16).
      value: Math.round((0.5 + entry.swordCount * 0.1) * 10) / 10,

      components: [{ kind: 'element', element: 'metal', ratio: 1 }],

      swordIntentDamageRatio: Math.round(0.0002 * entry.swordCount * 10000) / 10000,

      // Task 8 (2026-08-28) â€” Kiáº¿m Tráº­n keystone (Tam TÃ i) spawn 1
      // SwordZone táº¡i target sau khi báº¯n, xem SkillEffect.grantsSwordZone.
      // CHá»ˆ Ã¡p cho kiem_tran_tam_tai â€” 8 tráº­n cÃ²n láº¡i váº«n plain damage.
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

    remainingCooldown: 0,

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

    remainingCooldown: 0,

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

    remainingCooldown: 0,

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

    remainingCooldown: 0,

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

    remainingCooldown: 0,

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

    remainingCooldown: 0,

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

    remainingCooldown: 0,

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

    remainingCooldown: 0,


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

  // 9 skill Kiáº¿m Tráº­n (chiÃªu tráº­n) â€” generated tá»« KIEM_TRAN_SKILLS (xem
  // Ä‘á»‹nh nghÄ©a + comment cÃ´ng thá»©c á»Ÿ Ä‘áº§u file, table-driven tá»«
  // TRAN_SEQUENCE trong KiemTuNodes.ts).
  ...KIEM_TRAN_SKILLS,

  // 9 passive â€” má»—i cáº£nh giá»›i má»Ÿ khÃ³a 1, nguá»“n map náº±m á»Ÿ tÃ¢m phÃ¡p tu
  // luyá»‡n (xem Technique.passiveSkillIdsByRealm trong
  // data/technique/Techniques.ts vÃ  GameManager.syncRealmPassive()).
  // Má»—i cÃ¡i dÃ¹ng passiveTrigger khÃ¡c nhau â€” khÃ´ng dÃ¹ng chung 1 Ä‘iá»u
  // kiá»‡n tÃ­ch stack.
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

    // PhÃ¡p Tu Redesign (magicpath, 2026-08-18) â€” cultivationRate Ä‘Ã£ bá»‹
    // xoÃ¡ khá»i Stats (tá»‘c Ä‘á»™ tu luyá»‡n giá» cá»‘ Ä‘á»‹nh, khÃ´ng ai tÄƒng Ä‘Æ°á»£c
    // ná»¯a), passiveModifiers CÅ¨ cá»§a skill nÃ y (buff cultivationRate)
    // khÃ´ng cÃ²n há»£p lá»‡. Táº M Ä‘á»ƒ trá»‘ng, chÆ°a gÃ¡n stat má»›i â€” xem audit
    // cuá»‘i phiÃªn [[tienhiep-phap-tu-magicpath]], cáº§n quyáº¿t Ä‘á»‹nh láº¡i
    // hÆ°á»›ng passive nÃ y (Ä‘á»•i sang combat stat, hay bá» háº³n) khi lÃ m ná»™i
    // dung "class chÃ­nh thá»©c".
    description:
      'Nguyên Anh thấu triệt — cảm ngộ sâu hơn với thiên địa (hiện chưa có hiệu ứng, đang chờ thiết kế lại).',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    requiredRealmId: 'nascent_soul',

    cooldown: 0,

    remainingCooldown: 0,


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


    target: 'self',

    effects: [],

    passiveModifiers: [
      {
        id: 'passive_dai_thua_dao_tam_attunement',

        sourceId: 'passive_dai_thua_dao_tam',
        sourceType: 'skill',

        // TrÆ°á»›c cá»™ng %magicAttack (stat Ä‘Ã£ xoÃ¡, gá»™p vÃ o tá»•ng há»£p 5
        // hÃ nh) â€” Ä‘á»•i sang Linh CÄƒn (Attunement), khá»›p tháº³ng Ã½ nghÄ©a
        // "Ä‘áº¡o tÃ¢m viÃªn mÃ£n, phÃ¡p lá»±c tÄƒng dáº§n" vÃ  tá»± lan toáº£ Ä‘á»u
        // sang cáº£ 6 hÃ nh qua táº§ng dáº«n xuáº¥t (xem
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

  // Ná»™i táº¡i chiáº¿n Ä‘áº¥u cá»§a TÃ¢m PhÃ¡p Chiáº¿n Äáº¥u â€” tá»± há»c + equip khi
  // technique tÆ°Æ¡ng á»©ng Ä‘Æ°á»£c trang bá»‹ (xem GameManager.equipTechnique()),
  // KHÃ”NG liÃªn quan tá»›i há»‡ thá»‘ng 9 passive theo cáº£nh giá»›i á»Ÿ trÃªn.
  {
    id: 'passive_thai_hu_kiem_y',

    name: 'Thái Hư Kiếm Ý',

    description: 'Kiếm ý thấu triệt hư vô, mỗi đòn chí mạng dồn thêm sát khí.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,

    remainingCooldown: 0,


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

  // ==================================================================
  // Pháp Tu Thuần Hệ (spec 2026-09-03 §2/§3, Task 10) — 20 skill chuỗi
  // B/C/D/E + 5 Ultimate của 5 thần Sơn Hải Kinh, THAY 25 placeholder
  // id cũ (chuc_dung_b...thanh_luy — tên/id/số liệu ĐÚNG bảng spec,
  // N2b: không hậu tố _b/_c). A là root hiện có của từng hành
  // (hoa_cau_thuat / thuy_tien_thuat / doc_chuong / diem_kim_thuat /
  // tho_cau_thuat — giữ nguyên). Nhịp §1.2: B cd2/cast1.0, C cd3/1.2,
  // D cd4/1.4, E cd6/1.8. Ngân sách dmg §1.3: B 1.1 · C 1.3 (0 nếu
  // self-buff) · D 1.5 · E 2.4; mọi damage mang manaScalingRatio
  // 0.001 + attributeScaling attunement 0.004 (như A). resourceType
  // 'none' (§1.4); unlocked false, mở qua node chuỗi (Task 11, §1.7 —
  // B–E KHÔNG requiredRealmId, realm gate ở node + bảng slot).
  // Biến thể C/D = SkillSpecialization (effectsOverride/targetingOverride
  // theo node selectsSpecialization E-8 — id specialization khớp
  // specializationId trong PhapTuNodes.ts Task 11).
  // ==================================================================

  // ── Chuỗi CHÚC DUNG (Hỏa — bùng nổ dồn, §2.1): A/B/C chồng Thiêu
  // Đốt (bong stack — N1), D kích nổ TOÀN BỘ Bỏng, E nuke lan cả hàng.
  {
    id: 'nam_minh_liet_hoa',
    name: 'Nam Minh Liệt Hỏa',
    description: 'Lửa Nam phương nối đuôi Hỏa Cầu — đắp thêm tầng Bỏng chồng lên mục tiêu.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    remainingCooldown: 0,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'bong', ailmentChance: 0.75 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'tam_muoi_chan_hoa',
    name: 'Tam Muội Chân Hỏa',
    description: 'Ba ngọn chân hỏa — đắp Bỏng mạnh; biến thể quyết định tụ hay tán.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    remainingCooldown: 0,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.3,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'bong', ailmentChance: 1 },
    ],
    // Biến thể C (§2.1) — mua node selectsSpecialization là ĐỔI HẲN
    // hành vi (E-8). 'tam_muoi_tu_diem': single + đắp THÊM 1 tầng qua
    // add_stack (E-3 — buff đã chạy mới cộng, chưa có = no-op; debuff
    // apply phía dưới đảm bảo có ≥1 tầng khi roll trúng).
    specializations: [
      {
        id: 'tam_muoi_tu_diem',
        name: 'Tam Muội · Tụ Diễm',
        description: 'Ba ngọn lửa tụ một điểm — đắp 2 tầng Bỏng mỗi cast.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'bong', ailmentChance: 1 },
          { type: 'add_stack', buffId: 'bong', stacks: 1 },
        ],
      },
      {
        id: 'tam_muoi_tan_diem',
        name: 'Tam Muội · Tán Diễm',
        description: 'Lửa tán thành vùng — Bỏng phủ mọi mục tiêu xung quanh.',
        // Spec §2.1: Tán Diễm là AoE — base skill không khai targeting
        // (single) nên specialization PHẢI tự mang vùng (laneRadius 1).
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'bong', ailmentChance: 0.7 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'chuc_dung_dan_no',
    name: 'Chúc Dung Dẫn Nộ',
    description: 'Chúc Dung dẫn nộ — kích nổ TOÀN BỘ Bỏng trên mục tiêu thành true damage.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    remainingCooldown: 0,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'bong',
        damagePerStack: 35,
      },
    ],
    // Biến thể D (§2.1): Liệt Bạo = damagePerStack 50 burst tối đa;
    // Dư Hỏa = 30 + áp lại 1 tầng Bỏng SAU kích nổ (debuff effect chạy
    // sau damage — applyAll reorder damage trước, debuff sau).
    specializations: [
      {
        id: 'dan_no_liet_bao',
        name: 'Dẫn Nộ · Liệt Bạo',
        description: 'Nộ hỏa bùng nổ — mỗi tầng Bỏng nổ mạnh hơn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            consumesAilmentId: 'bong',
            damagePerStack: 50,
          },
        ],
      },
      {
        id: 'dan_no_du_hoa',
        name: 'Dẫn Nộ · Dư Hỏa',
        description: 'Kích nổ xong còn than hồng — giữ Bỏng để lặp chuỗi nhanh.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            consumesAilmentId: 'bong',
            damagePerStack: 30,
          },
          { type: 'debuff', buffId: 'bong', ailmentChance: 1 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'hoa_ha_cuu_thien',
    name: 'Hỏa Hà Cửu Thiên',
    description: 'Sông lửa đổ xuống chín tầng trời — nuke lan cả hàng, đòn kết chuỗi.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    remainingCooldown: 0,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    targeting: { shape: 'line' },
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'bong', ailmentChance: 1 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },

  // ── Chuỗi THIÊN NGÔ (Thủy — kiềm chế + hồi, §2.2): B Tê Cóng, C hồi
  // Pháp Lực (self), D trói + tự buff hấp thụ, E sóng càn quét.
  {
    id: 'bat_dau_tran_thuy',
    name: 'Bát Đầu Trấn Thủy',
    description: 'Tám đầu Thiên Ngô trấn áp — đòn Thủy trầm ổn gây Tê Cóng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    remainingCooldown: 0,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'te_cong', ailmentChance: 0.8 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'thanh_tuyen_duong_linh',
    name: 'Thanh Tuyền Dưỡng Linh',
    description: 'Suối thiêng Thanh Tuyền — nuôi Pháp Lực hồi nhanh trong chốc lát.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    remainingCooldown: 0,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'thanh_tuyen' }],
    // Biến thể C (§2.2): Tuyền = buff mạnh hơn (+12 regen, 8s — duration
    // override trên effect, xem SkillEffectSystem case 'buff' đọc
    // effect.duration ?? definition.duration); Băng Giáp = đổi sang
    // ward phòng thủ.
    specializations: [
      {
        id: 'duong_linh_tuyen',
        name: 'Dưỡng Linh · Tuyền',
        description: 'Mạch suối dồi dào — hồi Pháp Lực mạnh và lâu hơn.',
        effectsOverride: [{ type: 'buff', buffId: 'thanh_tuyen', duration: 8 }],
      },
      {
        id: 'duong_linh_bang_giap',
        name: 'Dưỡng Linh · Băng Giáp',
        description: 'Nước đóng băng giáp — Thủy thiên về phòng thủ.',
        effectsOverride: [{ type: 'buff', buffId: 'bang_giap' }],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'hoi_luu_thon_no',
    name: 'Hồi Lưu Thôn Nộ',
    description: 'Vòng nước cuốn hút — trói chân mục tiêu, sóng hồi lưu hấp thụ đòn đánh.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    remainingCooldown: 0,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.7 },
      { type: 'buff', buffId: 'hoi_luu' },
    ],
    // Biến thể D (§2.2): Cấm Túc = trói chắc 100%, bỏ hấp thụ; Hấp Lưu
    // = trói 50% nhưng leech mạnh hơn, lâu hơn.
    specializations: [
      {
        id: 'thon_no_cam_tuc',
        name: 'Thôn Nộ · Cấm Túc',
        description: 'Nước xiềng chặt chân — không lối thoát.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'water', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
        ],
      },
      {
        id: 'thon_no_hap_luu',
        name: 'Thôn Nộ · Hấp Lưu',
        description: 'Dòng hút xoáy sâu — sinh lực địch chảy về ta.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'water', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.5 },
          // Spec §2.2: leech +35%, 5s — buff định nghĩa 0.20/tầng, 2
          // tầng = 0.40 (over-tuned); thay bằng 1 tầng + duration 5s
          // đúng số liệu spec (xem ghi chú report).
          // Review round 1 (Finding 2) — coordinator ruling: GIỮ 0.20
          // (hoi_luu = +0.20/stack refresh; +35% không biểu diễn được
          // nếu không thêm buff mới — deviation có chủ đích, đã ghi
          // chú report).
          { type: 'buff', buffId: 'hoi_luu', duration: 5 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'bac_hai_cuong_lan',
    name: 'Bắc Hải Cuồng Lan',
    description: 'Sóng Bắc Hải càn quét mọi dải cột — đòn kết chuỗi gây Tê Cóng diện rộng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    remainingCooldown: 0,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    targeting: { shape: 'all_lanes', columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'te_cong', ailmentChance: 1 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },

  // ── Chuỗi CÂU MANG (Mộc — nhiễm độc lan, §2.3): B đắp Trúng Độc,
  // C rễ cấm di chuyển, D LAN độc (E-1), E kích nổ + hút máu.
  {
    id: 'xuan_sanh_doc_duc',
    name: 'Xuân Sanh Độc Dực',
    description: 'Cánh độc Câu Mang vươn tới — đòn Xuân sinh đầy độc tố.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    remainingCooldown: 0,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'trung_doc', ailmentChance: 1 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'cau_mang_can_tri',
    name: 'Câu Mang Căn Trì',
    description: 'Rễ Câu Mang mọc trùm mục tiêu — cấm di chuyển, độc ngấm sâu.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    remainingCooldown: 0,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.3,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.8 },
      { type: 'debuff', buffId: 'trung_doc', ailmentChance: 0.6 },
    ],
    // Biến thể C (§2.3): Cấm Bộ = root BẢN DÀI (buff riêng cau_mang_can
    // 4s, troi_chan 100%), bỏ độc; Thâm Độc = bỏ root, đắp +2 tầng độc.
    specializations: [
      {
        id: 'can_tri_cam_bo',
        name: 'Căn Trì · Cấm Bộ',
        description: 'Rễ xiết chặt — mục tiêu không nhúc nhích nổi.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
          { type: 'debuff', buffId: 'cau_mang_can', ailmentChance: 1 },
        ],
      },
      {
        id: 'can_tri_tham_doc',
        name: 'Căn Trì · Thâm Độc',
        description: 'Độc ngấm tận rễ — Trúng Độc chồng sâu hơn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'trung_doc', ailmentChance: 1 },
          { type: 'add_stack', buffId: 'trung_doc', stacks: 2 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'van_moc_lan_doc',
    name: 'Vạn Mộc Lan Độc',
    description: 'Rừng cây lan độc — sao chép Trúng Độc từ mục tiêu chính sang mọi địch trong vùng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    remainingCooldown: 0,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        // E-1 spread ĐẶT TRÊN EFFECT SCOPE 'primary_target' (ruling
        // reviewer): resolver chạy damage scope primary ĐÚNG 1 LẦN với
        // ctx.targetBuffs = pool primary → đọc stack primary, áp cho
        // target phụ. Để scope mặc định (affected_targets) sẽ chạy mỗi
        // target một lần → N× duplicate.
        spreadsAilmentId: 'trung_doc',
        spreadStackPercent: 1,
        scope: 'primary_target',
      },
    ],
    // Biến thể D (§2.3): Quảng = all_lanes spread 50%; Thâm = area
    // spread 100% + refresh duration primary.
    specializations: [
      {
        id: 'lan_doc_quang',
        name: 'Lan Độc · Quảng',
        description: 'Độc theo gió bay khắp chiến trường.',
        // Spec §2.3: Quảng = all_lanes columnRadius 1.
        targeting: { shape: 'all_lanes', columnRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            spreadsAilmentId: 'trung_doc',
            spreadStackPercent: 0.5,
            scope: 'primary_target',
          },
        ],
      },
      {
        id: 'lan_doc_tham',
        name: 'Lan Độc · Thâm',
        description: 'Độc ngấm thấu xương — lan trọn vẹn, giữ chân nguồn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            spreadsAilmentId: 'trung_doc',
            spreadStackPercent: 1,
            spreadRefreshesPrimary: true,
            scope: 'primary_target',
          },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'doc_vien_bao_can',
    name: 'Độc Viên Bạo Căn',
    description: 'Vườn độc nổ rễ trăm trượng — kích nổ Trúng Độc, hút sinh lực hồi bản thân.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    remainingCooldown: 0,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'trung_doc',
        damagePerStack: 30,
        healPercentOfDamage: 0.4,
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },

  // ── Chuỗi NHỤC THU (Kim — nghiền nát kim loại, KHÔNG kiếm pháp,
  // §2.4): B Kim Giáp tự buff, C Kim Lang bão vụn AoE, D Kim Chung
  // khuếch đại Xuất Huyết (add_stack E-3), E Kim Luân kích nổ.
  {
    id: 'thu_giap_kim_than',
    name: 'Thu Giáp Kim Thân',
    description: 'Thu sát ngưng thành giáp thép — tự hoá kim, dày phòng thủ, gai phản đòn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    remainingCooldown: 0,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'kim_giap' }],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'kim_lang_toan_phong',
    name: 'Kim Lang Toàn Phong',
    description: 'Bão vụn thép xoáy quanh — Xuất Huyết phủ mọi kẻ địch trong vùng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    remainingCooldown: 0,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.2,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'chay_mau', ailmentChance: 0.6 },
    ],
    // Biến thể C (§2.4): Toàn Vực = AoE vuông rộng hơn dmg 1.0 bleed
    // 50%; Xuyên Liệt = line dmg 1.4 bleed 80%.
    specializations: [
      {
        id: 'kim_lang_toan_vuc',
        name: 'Kim Lang · Toàn Vực',
        description: 'Vụn thép phủ trọn một vùng.',
        // Spec §2.4: Toàn Vực = area laneRadius 1 columnRadius 1.
        targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'chay_mau', ailmentChance: 0.5 },
        ],
      },
      {
        id: 'kim_lang_xuyen_liet',
        name: 'Kim Lang · Xuyên Liệt',
        description: 'Lưỡi bão xuyên thẳng một hàng.',
        // Spec §2.4: Xuyên Liệt = line.
        targeting: { shape: 'line' },
        effectsOverride: [
          {
            type: 'damage',
            value: 1.4,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'chay_mau', ailmentChance: 0.8 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'kim_chung_cong_huong',
    name: 'Kim Chung Cộng Hưởng',
    description: 'Chuông thép Nhục Thu rung — cộng hưởng khuếch đại Xuất Huyết trên mục tiêu.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    remainingCooldown: 0,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      // add_stack chạy SAU damage (applyAll reorder) — buff đã chạy mới
      // cộng (E-3), chưa có = no-op.
      { type: 'add_stack', buffId: 'chay_mau', stacks: 2, refresh: true },
    ],
    // Biến thể D (§2.4): Tích Huyết = +3 không choáng; Chấn Huyết = +1
    // kèm 30% Choáng.
    specializations: [
      {
        id: 'cong_huong_tich_huyet',
        name: 'Cộng Hưởng · Tích Huyết',
        description: 'Tiếng chuông dồn máu — Xuất Huyết chồng chất.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'add_stack', buffId: 'chay_mau', stacks: 3, refresh: true },
        ],
      },
      {
        id: 'cong_huong_chan_huyet',
        name: 'Cộng Hưởng · Chấn Huyết',
        description: 'Chuông chấn đến choáng váng.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'add_stack', buffId: 'chay_mau', stacks: 1, refresh: true },
          { type: 'debuff', buffId: 'choang', ailmentChance: 0.3 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'kim_luan_tran_ap',
    name: 'Kim Luân Trấn Áp',
    description: 'Đĩa thép khổng lồ đè nghiền — kích nổ TOÀN BỘ Xuất Huyết (đòn kết chuỗi).',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    remainingCooldown: 0,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'chay_mau',
        damagePerStack: 40,
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },

  // ── Chuỗi HẬU THỔ (Thổ — phòng tuyến, §2.5): B Thạch Hóa + chấn,
  // C cột đất đỡ đòn (self ward), D chấn địa AoE, E nhốt + nổ khiên.
  {
    id: 'hau_tho_tran_ach',
    name: 'Hậu Thổ Trấn Ách',
    description: 'Đá thiêng trấn ải — Thạch Hóa thân địch, chấn động làm choáng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    remainingCooldown: 0,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'thach_hoa', ailmentChance: 0.7 },
      { type: 'debuff', buffId: 'choang', ailmentChance: 0.2 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'dia_tru_thua_thien',
    name: 'Địa Trụ Thừa Thiên',
    description: 'Cột đất thiêng đỡ trời — khiên hộ thể dày thêm, phản đòn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    remainingCooldown: 0,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'dia_tru' }],
    // Biến thể C (§2.5, review round 1): Bích = khiên THUẦN nuôi E nổ
    // to (buff riêng dia_tru_bich +100 ward/+8 regen, không thorns);
    // Thứ = phản đòn (buff riêng dia_tru_thu +40 ward/+25% thorns).
    // Không mượn bang_giap/kim_giap — sai số liệu + đụng tên đa hành.
    specializations: [
      {
        id: 'dia_tru_bich',
        name: 'Địa Trụ · Bích',
        description: 'Tường đất vững chãi — khiên dày để dồn cho đòn chót.',
        effectsOverride: [{ type: 'buff', buffId: 'dia_tru_bich' }],
      },
      {
        id: 'dia_tru_thu',
        name: 'Địa Trụ · Thứ',
        description: 'Đất hóa gai nhọn — ai chạm vào cũng đau.',
        effectsOverride: [{ type: 'buff', buffId: 'dia_tru_thu' }],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'con_lon_chan_dia',
    name: 'Côn Lôn Chấn Địa',
    description: 'Chấn địa Côn Lôn — mọi kẻ đứng trên đất rung chuyển choáng váng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    remainingCooldown: 0,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'choang', ailmentChance: 0.4 },
    ],
    // Biến thể D (§2.5): Trấn = single dmg 1.7 choáng 70%; Quảng =
    // area laneRadius 2 dmg 1.3 choáng 25%.
    specializations: [
      {
        id: 'chan_dia_tran',
        name: 'Chấn Địa · Trấn',
        description: 'Trấn xuống đúng một điểm — chấn động tê liệt.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.7,
            components: [{ kind: 'element', element: 'earth', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'choang', ailmentChance: 0.7 },
        ],
      },
      {
        id: 'chan_dia_quang',
        name: 'Chấn Địa · Quảng',
        description: 'Động đất lan rộng — choáng nhẹ nhưng trúng nhiều.',
        // Spec §2.5: Quảng = area laneRadius 2 columnRadius 1.
        targeting: { shape: 'square', laneRadius: 2, columnRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'earth', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'choang', ailmentChance: 0.25 },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'cuu_tru_dia_lao',
    name: 'Cửu Trù Địa Lao',
    description: 'Ngục đất nhốt mục tiêu — trói chân, nổ toàn bộ khiên thành sát thương.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    remainingCooldown: 0,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesWardForDamage: true,
        damagePerWardPoint: 1.5,
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  },

  // ── 5 ULTIMATE Thuần hệ (spec §3) — Thế đầy 100 (+bonus) → reset 0.
  // buildTag 'ult' (không vào loadout scheduler), cooldown 0, cast
  // 1.5s, unlocked false (mở qua node ult — Task 11). Damage value
  // 4.0 chuẩn; hiệu ứng đặc trưng per-element qua engine E-1..E-6.
  {
    id: 'tat_phuong_giang_the',
    name: 'Tất Phương Giáng Thế',
    description: 'Điểu hỏa một chân giáng thế — lửa phủ mọi dải cột, để lại vùng cháy sáu nhịp.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    remainingCooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes', columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 4,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        grantsZone: true,
        zoneElement: 'fire',
        swordZoneCharges: 6,
        swordZoneTickInterval: 1,
        swordZoneDamageRatio: 0.5,
      },
      { type: 'debuff', buffId: 'bong', ailmentChance: 1 },
    ],
    resourceType: 'none',
    buildTag: 'ult',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'bat_thu_can_quet',
    name: 'Bát Thủ Càn Quét',
    description: 'Tám đầu Thiên Ngô dâng tám đợt sóng — càn quét mọi địch, gột rửa tối đa 8 debuff trên thân.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    remainingCooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes' },
    effects: [
      {
        type: 'damage',
        value: 0.6,
        hitCount: 8,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'te_cong', ailmentChance: 1 },
      { type: 'remove_buff', scope: 'source', polarity: 'debuff', count: 8 },
    ],
    resourceType: 'none',
    buildTag: 'ult',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'kien_moc_thong_thien',
    name: 'Kiến Mộc Thông Thiên',
    description: 'Rễ trăm trượng nối trời đất — trói và nhiễm độc mọi địch, vườn độc sáu nhịp.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    remainingCooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes' },
    effects: [
      {
        type: 'damage',
        value: 4,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        grantsZone: true,
        zoneElement: 'wood',
        swordZoneCharges: 6,
        swordZoneTickInterval: 1,
        swordZoneDamageRatio: 0.4,
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
      { type: 'debuff', buffId: 'trung_doc', ailmentChance: 1 },
      { type: 'add_stack', buffId: 'trung_doc', stacks: 2 },
    ],
    resourceType: 'none',
    buildTag: 'ult',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'kim_phat_thu_sat',
    name: 'Kim Phạt Thu Sát',
    description: 'Thu là mùa hình phạt — đĩa thép đè nghiền ĐÚNG một mục tiêu (ưu tiên boss), nổ toàn bộ Xuất Huyết, sát thương dư không tràn.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    remainingCooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 6,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'chay_mau',
        damagePerStack: 80,
      },
    ],
    resourceType: 'none',
    buildTag: 'ult',
    unlocked: false,
    equipped: false,
  },
  {
    id: 'hau_tho_thanh_luy',
    name: 'Hậu Thổ Thành Lũy',
    description: 'Thành đất thiêng vây khốn mọi địch — mỗi kẻ bị nhốt thêm 6% phòng thủ, tối đa 8 tầng.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    remainingCooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes' },
    effects: [
      {
        type: 'damage',
        value: 4,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
      { type: 'buff', buffId: 'thanh_luy', stacksPerAffectedTarget: true },
    ],
    resourceType: 'none',
    buildTag: 'ult',
    unlocked: false,
    equipped: false,
  },
]

// Pháp Tu Thuần Hệ (spec 2026-09-03 §2) — ánh xạ chuỗi 5 skill theo
// hành cho ChainDefinition (BattleSystem.setChainDefinition) + node
// unlock (PhapTuNodes Task 11). A là root hiện có của hành; B–E là 20
// skill mới bên trên (id N2b — không hậu tố _b/_c).
export const CHAIN_SKILL_IDS: Record<ElementType, readonly string[]> = {
  fire: ['hoa_cau_thuat', 'nam_minh_liet_hoa', 'tam_muoi_chan_hoa', 'chuc_dung_dan_no', 'hoa_ha_cuu_thien'],
  water: ['thuy_tien_thuat', 'bat_dau_tran_thuy', 'thanh_tuyen_duong_linh', 'hoi_luu_thon_no', 'bac_hai_cuong_lan'],
  wood: ['doc_chuong', 'xuan_sanh_doc_duc', 'cau_mang_can_tri', 'van_moc_lan_doc', 'doc_vien_bao_can'],
  metal: ['diem_kim_thuat', 'thu_giap_kim_than', 'kim_lang_toan_phong', 'kim_chung_cong_huong', 'kim_luan_tran_ap'],
  earth: ['tho_cau_thuat', 'hau_tho_tran_ach', 'dia_tru_thua_thien', 'con_lon_chan_dia', 'cuu_tru_dia_lao'],
}
