import type { Skill } from '../../core/skill/Skill'
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

    effects: [
      {
        type: 'damage',

        value: 1,

        damageType: 'physical',

        // Final review fix (Important #3) â€” dead % ratio tá»« thá»i maxLevel
        // 18 cÅ©. Huy Kiáº¿m rework (spec Â§2) lÃ  skill DUY NHáº¤T Ä‘i flat-only
        // (+1 dmg/10 cast qua SkillSystem.getEffectiveSkill()); ratio nÃ y
        // tá»«ng cá»™ng thÃªm 1 lá»›p % nhÃ¢n totalExperience/attack lÃªn trÃªn flat,
        // double-scale ngoÃ i spec.
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
        type: 'ailment',

        ailmentId: 'bong',

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
        type: 'ailment',

        ailmentId: 'trung_doc',

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
        type: 'ailment',

        ailmentId: 'te_cong',

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
        type: 'ailment',

        ailmentId: 'chay_mau',

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
        type: 'ailment',

        ailmentId: 'thach_hoa',

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
]
