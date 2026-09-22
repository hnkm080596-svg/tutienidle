import type { Skill } from '../../core/skill/Skill'

// Skill execution policy rework (plan sec.8) - EVERY active skill declares
// `execution` explicitly; runtime reads only this field (no fallback
// isBasicAttack/castTime/path):
// - Tram + Ngu Kiem Thuat -> 'attack_speed' (cadence by Attack Speed,
//   no ICD/no CDR/no cast time).
// - the 5 Phap Tu skills with 1.2s cast time keep their numbers via the
//   'cast_time' policy (cast time scales with Cast Speed, cooldown with CDR).
// - remaining actives -> 'cooldown' with their existing cooldowns.
// - 'attack_speed_cast' is assigned to no skill yet (author only when the
//   design explicitly requires it - plan sec.8.3).
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

    // Plan sec.8.3 - baseline preserves behavior: cadence follows Attack Speed.
    execution: { kind: 'attack_speed' },

    resourceType: 'none',


  },

  // Phap Tu Reimagined Task 2 - the two mortal-path actives learned
  // alongside tram at character creation. Both level ONLY by cast count
  // (CAST_LEVELING_THRESHOLDS; their cores reject Insight upgrades, INV-9).
  // linh_bao Lv3 (10000 casts) is the ngo_dao ritual gate; its
  // primordial hit "ignores all defenses" like the Hon Nguyen stat.
  {
    id: 'linh_bao',

    name: 'Linh Bạo',

    // Spec sec.11 discoverability hint - the one in-game tell that pushing
    // Linh Bao to its limit BEFORE the Initiation Ritual opens a road
    // others cannot see (ngo_dao). No locked card tease anywhere.
    description: 'Tụ linh khí bùng nổ, bỏ qua mọi phòng thủ. Nghe đồn kẻ đẩy nó đến cực hạn trước Nghi Lễ Nhập Môn sẽ thấy một con đường người khác không thấy.',

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


  },

  // The Tu Reimagined (spec 2026-09-15, T6/section 2.3) - huy_quyen is
  // also the ung_the ritual gate: reaching Lv3 (10.000 casts) is the
  // ONLY condition revealing that path at the Initiation Ritual.
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


  },

  // ------------------------------------------------------------------
  // Phap Tu An kit (Task 7, phap-tu-reimagined) - DATA SHELLS only:
  // ids, slots, targeting, labels for the ritual grant. Resolution
  // semantics (composite element pick / repeat / multicast) land in the
  // An-resolution task - the payloads below are placeholders.
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

    // Placeholder damage (same convention as van_phap_tuy_tam) - the
    // strict Skill->TurnSkill gate requires a damage/debuff effect on a
    // non-self skill; applyAnKitToSpecial replaces the payload with the
    // composite pick + repeatCasts at battle build.
    effects: [
      {
        type: 'damage',

        value: 1,

        damageType: 'primordial',
      },
    ],

    execution: { kind: 'cooldown' },

    resourceType: 'none',


  },

  {
    id: 'ngo_dao_hon_don',

    name: 'Ngộ Đạo Hỗn Độn',

    // Spec sec.3.3 + sec.11 - the HUD renders this as a passive emblem (no
    // active button); the tooltip must explain basic-slot-only multicast.
    description: 'Ngộ đạo hỗn độn — chỉ đòn ở ô Thường (Vạn Pháp Tùy Tâm) mới có thể tự phân luồng (multicast). Đa Pháp Liên Tuyên không kích hoạt.',

    type: 'passive',

    level: 1,

    maxLevel: 1,

    cooldown: 0,

    target: 'self',

    effects: [],

    resourceType: 'none',


  },



  // Hoa Tu (Plans/magicpathgeneral + Plans/FirePath, 2026-08-21) -
  // FULLY REPLACES the old 3-skill+1-passive kit (xich_viem_chuong/viem_hai/
  // bao_viem/passive_bao_viem_focus, removed). New framework: 1 Active
  // Skill ONLY per element (no more multi-skill kit) - depth
  // comes from the Node Tree (Minor changes stats, Major changes THIS skill's tag/behavior
  // itself), see data/progression/PhapTuNodes.ts. Learned upfront
  // at path choice (GameManager.chooseCultivationPath(), no longer via
  // the "Linh Ngo Hoa" node - that node was removed from PhapTuNodes.ts).
  {
    id: 'hoa_cau_thuat',

    name: 'Hỏa Cầu Thuật',

    description: 'Phóng Hỏa Cầu vào mục tiêu, có cơ hội gây Thiêu Đốt.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan sec.3.3) - Fire (burst):
    // cast 1.6s / cooldown 4s - slow heavy hit, replacing the old 1.2/1 cadence.
    cooldown: 4,


    castTime: 1.6,

    // Plan sec.8.3 - the 'cast_time' policy is the runtime source of truth; the
    // castTime field above stays in sync for UI/tooltips.
    execution: { kind: 'cast_time', castTime: 1.6 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        // FirePath.md sec.2 - "Damage: 100% Skill Power".
        value: 1,

        components: [{ kind: 'element', element: 'fire', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'debuff',

        buffId: 'hoa_an',

        // 2026-08-21 - REVISED the original decision ("always 100% apply"):
        // original Hoa Cau Thuat only has a 50% chance to apply Burn; the "Dan
        // Hoa" (+15%) and "Hoa Nguyen" (+5%) nodes at Truc Co add more via
        // stat elementApplicationPercent (xem resolveAilmentApplicationChance,
        // data/progression/PhapTuNodes.ts) - so those nodes carry real
        // meaning instead of stacking onto an already-maxed number.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) - this skill is the ROOT NODE of the
    // Fire tree (see PhapTuNodes.ts), occupying the BASIC role slot
    // and running through the unified auto-cast scheduler like every other skill.
    // The ONLY difference between Hoa Cau Thuat and the other 4 elements: it is
    // self-learned + placed in the basic role slot (cost 0, see GameManager.chooseCultivationPath()).


    resourceType: 'none',

    buildTag: 'burst',


  },

  // Moc Tu (Plans/PoisonPath, 2026-08-21) - FULLY REPLACES the 3-skill+1-
  // passive kit (dang_trao/doc_vu/hap_tinh_dai_phap/passive_hap_tinh_tuy,
  // removed). Same 1-Active-Skill/element framework as Fire/Water - depth
  // comes from the Node Tree, see data/progression/PhapTuNodes.ts. Learned
  // upfront at path choice (GameManager.chooseCultivationPath()). UNLIKE Fire/Water:
  // 0 direct damage (only the 'ailment' effect, NO 'damage' effect
  // at all - PoisonPath.md sec.1 "0 direct damage"), ailmentChance FIXED
  // 100% - Moc has NO Element Application Chance/minor adjusting this
  // rate (unlike Hoa Cau Thuat/Thuy Tien Thuat 50% base + node-boosted
  // extra); all damage comes from the Poison DoT.
  {
    id: 'doc_chuong',

    name: 'Độc Chưởng',

    description:
      'Vỗ độc chưởng vào mục tiêu, không gây sát thương trực tiếp nhưng luôn áp Trúng Độc.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan sec.3.3) - Wood (DoT): cast
    // 1.2s / cooldown 2s - strong poison application, mid cadence.
    cooldown: 2,


    castTime: 1.2,

    // Plan sec.8.3 - the 'cast_time' policy is the runtime source of truth; the
    // castTime field above stays in sync for UI/tooltips.
    execution: { kind: 'cast_time', castTime: 1.2 },

    target: 'enemy',

    effects: [
      {
        type: 'debuff',

        buffId: 'doc_can',

        ailmentChance: 1,
      },
    ],

    // Skill tree redesign (2026-08-21) - root node of the Wood tree, taking
    // BASIC role (see hoa_cau_thuat's note).
    resourceType: 'none',

    buildTag: 'core',


  },

  // Thuy Tu (Plans/waterpath, 2026-08-21) - FULLY REPLACES the 3-skill+1-
  // passive kit (luu_thuy_chuong/han_trieu/tuyet_bang_pha/
  // passive_luu_thuy_man, removed). Same 1-Active-Skill/element
  // framework as Fire (see Skills.ts's note at hoa_cau_thuat) - depth
  // comes from the Node Tree, see data/progression/PhapTuNodes.ts. Learned
  // upfront at path choice (GameManager.chooseCultivationPath()).
  {
    id: 'thuy_tien_thuat',

    name: 'Thủy Tiễn Thuật',

    description: 'Bắn Thủy Tiễn vào mục tiêu, có cơ hội gây Tê Cóng.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan sec.3.3) - Water (sustain):
    // cast 0.9s / cooldown 1s - fast ailment-application cadence.
    cooldown: 1,


    castTime: 0.9,

    // Plan sec.8.3 - the 'cast_time' policy is the runtime source of truth; the
    // castTime field above stays in sync for UI/tooltips.
    execution: { kind: 'cast_time', castTime: 0.9 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        // waterpath sec.II - "Damage: 100% Skill Power".
        value: 1,

        components: [{ kind: 'element', element: 'water', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'debuff',

        buffId: 'han_tuc',

        // 2026-08-21 - same decision as Hoa Cau Thuat (see the note
        // there): 50% base, does NOT always apply - Thuy Dan (Luyen Khi)
        // and Dan Luu (Truc Co) add more via elementApplicationPercent.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) - this skill is the ROOT NODE of the
    // element tree (see PhapTuNodes.ts), taking the BASIC role and running through the unified auto-cast scheduler like every skill
    // other. The ONLY difference between Hoa Cau Thuat and the other 4 elements is
    // it is self-learned + placed in the basic role slot (cost 0, see GameManager.chooseCultivationPath()).
    resourceType: 'none',

    buildTag: 'core',


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

    // Combat Balance Pass (2026-08-29, plan sec.3.3) - Metal (pierce): cast
    // 1.0s / cooldown 2.5s - heavy single-target, fast-mid cadence.
    cooldown: 2.5,


    castTime: 1.0,

    // Plan sec.8.3 - the 'cast_time' policy is the runtime source of truth; the
    // castTime field above stays in sync for UI/tooltips.
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

        buffId: 'liet_thuong',

        ailmentChance: 0.4,
      },
    ],

    // Skill tree redesign (2026-08-21) - root node of the Metal tree, taking
    // BASIC role (see hoa_cau_thuat's note).
    resourceType: 'none',

    buildTag: 'core',


  },

  // Tho Tu (Plans/EarthPath, 2026-08-21) - FULLY REPLACES the 3-skill+1-
  // passive kit (ban_thach_quyen/thach_giap_tran/hau_tho_chan/
  // passive_ban_thach_kien_nhan, removed). Same 1-Active-
  // Skill/element framework as Fire/Water/Wood - depth comes from the Node Tree, see
  // data/progression/PhapTuNodes.ts. Learned upfront at path choice
  // (GameManager.chooseCultivationPath()). ailmentChance FIXED 100%
  // - Tho has NO Earth Application Chance/Petrify Chance/Minor adjusting
  // this rate (PoisonPath-style, like Moc), unlike Fire/Water's
  {
    id: 'tho_cau_thuat',

    name: 'Thổ Cầu Thuật',

    description: 'Bắn một Thổ Cầu vào mục tiêu, luôn gây Thạch Hóa.',

    type: 'active',

    level: 1,

    maxLevel: 10,

    // Combat Balance Pass (2026-08-29, plan sec.3.3) - Earth (control):
    // cast 1.4s / cooldown 5s - slow CC, control-focused.
    cooldown: 5,


    castTime: 1.4,

    // Plan sec.8.3 - the 'cast_time' policy is the runtime source of truth; the
    // castTime field above stays in sync for UI/tooltips.
    execution: { kind: 'cast_time', castTime: 1.4 },

    target: 'enemy',

    effects: [
      {
        type: 'damage',

        value: 1,

        components: [{ kind: 'element', element: 'earth', ratio: 1 }],

        manaScalingRatio: 0.001,

        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },

      {
        type: 'debuff',

        buffId: 'tran_an',

        ailmentChance: 1,
      },
    ],

    // Skill tree redesign (2026-08-21) - root node of the Earth tree, taking
    // BASIC role (see hoa_cau_thuat's note).
    resourceType: 'none',

    buildTag: 'core',


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


  },

]
