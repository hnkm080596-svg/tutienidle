import type { Buff } from '@/core/buff/Buff'

// Đột Phá Trúc Cơ (Phase 5) — áp lên buff PERSISTENT ngoài trận
// (GameManager.applyPersistentBuff()) khi thất bại Độ Kiếp (mục 13
// spec `breakthrough`) — phạt có cảm giác nhưng không huỷ hoại, KHÔNG
// reset cảnh giới. Xem composables/useTribulation.ts. Khai TRƯỚC mảng
// `buffs` bên dưới vì được tham chiếu lại trong đó.
export const KIEP_THUONG_DEBUFF: Buff = {
  id: 'kiep_thuong',

  name: 'Kiếp Thương',

  description:
    'Vết thương do Thiên Kiếp để lại sau khi Độ Kiếp thất bại, làm suy giảm toàn thân trong chốc lát.',

  category: 'debuff',

  duration: 60,

  stacks: 1,

  stackMode: 'refresh',

  modifiers: [
    {
      id: 'kiep_thuong_attack',
      sourceId: 'kiep_thuong',
      sourceType: 'debuff',
      stat: 'attack',
      percent: -0.15,
    },

    {
      id: 'kiep_thuong_defense',
      sourceId: 'kiep_thuong',
      sourceType: 'debuff',
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
export const buffs: Buff[] = [
  KIEP_THUONG_DEBUFF,

  // Pháp Tu (Thổ Tu, 2026-08-15) — Thạch Giáp Trận (special skill,
  // xem data/skill/Skills.ts) tự buff wardMax/thornsPercent tạm thời
  // lên bản thân, tái dùng effect 'buff' có sẵn (zero plumbing mới).
  {
    id: 'thach_giap_buff',

    name: 'Thạch Giáp',

    description:
      'Linh khí Thổ ngưng thành 1 lớp khiên đá tạm thời, tăng Hộ Thuẫn tối đa và khả năng phản đòn.',

    category: 'buff',

    duration: 6,

    stacks: 1,

    stackMode: 'refresh',

    modifiers: [
      {
        id: 'thach_giap_buff_ward_max',

        sourceId: 'thach_giap_buff',
        sourceType: 'buff',

        stat: 'wardMax',

        flat: 40,
      },

      {
        id: 'thach_giap_buff_thorns',

        sourceId: 'thach_giap_buff',
        sourceType: 'buff',

        stat: 'thornsPercent',

        flat: 0.1,
      },
    ],
  },

  // Thổ Tu ("Độc Thế" reaction, Thổ+Mộc, Plans/EarthPath mục VII,
  // 2026-08-21) — KHÔNG có `duration` (permanent, xem BuffSystem.
  // update()'s `remainingTime === undefined` guard — Buff này KHÔNG tự
  // hết hạn, chỉ tích/giữ nguyên tới hết trận). `percent` nhân với
  // `stacks` ở StatCalculator.runPipeline() — đúng "+5%/tầng, tối đa 5
  // tầng = +25%". Plans/magicpathgeneral Phase 7/8 (2026-08-21) — đổi
  // tên hiển thị "Độc Thế" -> "Độc Căn" (id GIỮ NGUYÊN 'doc_the', xem
  // ElementReaction.ts's `appliesBuffId: 'doc_the'`): plan định nghĩa
  // rõ "Độc Căn" LÀ Reaction Reward Buff cấp cho CASTER khi Mộc+Thổ
  // reaction thành công (buff NÀY, đúng y hệt), còn "Mộc Thế" là Pure
  // Buff riêng của Mộc (xem data/progression/PhapTuNodes.ts's
  // WOOD_TRUC_CO_PURE) — 2 tên trước đây bị đảo ngược. Phase 11 —
  // "+2% HP Recovery từ Poison Damage"/tầng (từng bị hoãn ở
  // EarthPath vì DoT tick chưa resolve được entity NGUỒN) giờ làm
  // thật, xem CombatSystem.applyDotDamage().
  {
    id: 'doc_the',

    name: 'Độc Căn',

    description:
      'Độc trên mục tiêu chuyển hóa thành sức mạnh của bản thân — mỗi tầng tăng Sát Thương Độc + hồi máu từ Trúng Độc, tối đa 5 tầng.',

    category: 'buff',

    stacks: 1,

    maxStacks: 5,

    stackMode: 'stack',

    modifiers: [
      {
        id: 'doc_the_ailment_potency',

        sourceId: 'doc_the',
        sourceType: 'buff',

        stat: 'ailmentPotencyPercent',

        percent: 0.05,
      },

      {
        id: 'doc_the_poison_recovery',

        sourceId: 'doc_the',
        sourceType: 'buff',

        stat: 'poisonRecoveryPercent',

        percent: 0.02,
      },
    ],
  },
]
