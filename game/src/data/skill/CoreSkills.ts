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

    vfxPresetId: 'tram_slash',


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

    vfxPresetId: 'linh_bao_burst',


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

    vfxPresetId: 'huy_quyen_strike',


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
