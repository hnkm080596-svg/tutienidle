// Phap Tu kit -- reimagine design (spec 2026-09-26). The kit is
// `{basic, special}` per element (SPELL_KIT_IDS pairs in Skills.ts):
// the five element basics live here (moved out of CoreSkills.ts, ids and
// specializations unchanged), plus the five specials -- self-cast Phap
// Trang windows that replace the chain specials/routes/empowered ults.
//
// What a Skill record cannot express is authored in the tables at the
// bottom and consumed by the engine's resolve seam (spec D8/D11/D15):
//   - specials' percent-of-max Linh Luc cost (PHAP_TU_TRANG_COST_*)
//   - window marker ops + Phap The rider ops (landedConsequences lanes)
//   - Kim Liet pierce + Kim empowered pierce (penetration constants)
// theGainOnLandedCast itself is stamped by the engine at
// resolveAuthoredBasic (spec D2) -- it is NOT a Skill field.
//
// DEFERRED-TO-ENGINE primitives referenced by spec name: SkillCondition
// 'stacks_below'; SkillTargetIntent 'other_enemy'/'other_enemies';
// SkillAilmentInteraction 'whenSourceBuff'; TurnSkillDefinition
// 'landedConsequences'/'resourceCostPercentOfMax'; deal_damage
// 'elementalPenetrationBonus'/'penetrationFromStacks'; buildPhapTheVariant.
import type { Skill } from '../../core/skill/Skill'
import type { ElementType } from '../../core/element/ElementType'
import type { AuthoredSkillOperation } from '../../core/skilldef/AuthoredOperation'
import { TRONG_THE_THRESHOLD } from '../buff/PhapTuTrangBuffs'

// ---------------------------------------------------------------------------
// Authored numbers (all initial values carry the spec's TBD flag --
// balance pass owns the final tuning).
// ---------------------------------------------------------------------------

/** Special cast cost: percent of MAX Linh Luc (spec D8, uniform 0.30).
    Stamped as `resourceCostPercentOfMax` on the converted
    TurnSkillDefinition by the resolve seam -- Skill.cost is flat-only and
    cannot express percent-of-max, so the records below leave `cost`
    unset. */
export const PHAP_TU_TRANG_COST_PERCENT_OF_MAX = 0.3

/** Tam Muoi potency multiplier for own-source Hoa An applications while
    the window is up (spec D12; rides the fire basic's ailmentInteractions
    gated by `whenSourceBuff: 'tam_muoi'`). */
export const TAM_MUOI_POTENCY_MULTIPLIER = 1.5

/** Thuy Phap The rider: secondary-hit coefficient vs the primary hit
    (spec D4). */
export const THUY_PHAP_THE_SECONDARY_COEFFICIENT = 0.5

/** Tho Phap The rider: shockwave coefficient vs the primary hit
    (spec D5, ~0.4x). */
export const THO_PHAP_THE_SHOCKWAVE_COEFFICIENT = 0.4

/** Kim Phap The rider: flat elementalPenetrationBonus on the empowered
    variant's primary hit (spec D7; initial authored value 25 on the
    Resistance scale). Stamped by the variant builder -- engine-owned. */
export const KIM_PHAP_THE_PENETRATION_BONUS = 25

/** Kim Liet per-stack penetration: stamped as `penetrationFromStacks`
    ({definitionId: 'kim_liet', perStack}) on the KIM basic's primary
    deal_damage op by the resolve seam, normal AND empowered (spec D11).
    Engine-owned field. */
export const KIM_LIET_PENETRATION_PER_STACK = 10

/** Trong Nhac delay: negative ActionGauge push fraction applied to the
    target's next action (spec D11 "push_gauge(loop, -delayFraction)"). */
export const TRONG_NHAC_DELAY_GAUGE_FRACTION = 0.5

/** Shared special cadence (authored, TBD): a recast mid-window refreshes
    the buff at full cost (spec D8). */
export const PHAP_TU_SPECIAL_COOLDOWN_TURNS = 5
export const PHAP_TU_SPECIAL_CAST_TIME = 1.2

export const PHAP_TU_SKILLS: Skill[] = [
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

        // Tam Muoi Chan Hoa (spec D12): while the caster holds the
        // tam_muoi window, the hoa_an application this hit emits gets a
        // potency modifier for the buff's lifetime. `whenSourceBuff` is
        // an ENGINE-owned SkillAilmentInteraction field -- the adapter
        // wraps the op in `if stacks_at_least(self, tam_muoi, 1)` after
        // the apply (gateOnApplyResult binds the fresh instance).
        ailmentInteractions: [
          {
            kind: 'add_modifier',
            buffId: 'hoa_an',
            whenSourceBuff: 'tam_muoi',
            modifier: {
              id: 'tam_muoi_potency',
              channel: 'potency',
              operation: 'multiply',
              value: TAM_MUOI_POTENCY_MULTIPLIER,
              reapply: 'replace',
              priority: 0,
              lifetime: { type: 'buff_lifetime' },
            },
          },
        ],
      },

      {
        type: 'debuff',

        buffId: 'hoa_an',

        // 2026-08-21 - REVISED the original decision ("always 100% apply"):
        // original Hoa Cau Thuat only has a 50% chance to apply Burn; Truc Co
        // application-chance nodes raise it via the multiplicative
        // elementApplicationPercent pool (ApplicationResolver: chance =
        // baseChance x (1 + pool)) - so those nodes carry real meaning
        // instead of stacking onto an already-maxed number.
        ailmentChance: 0.5,
      },
    ],

    // Skill tree redesign (2026-08-21) - this skill is the ROOT NODE of the
    // Fire tree (see PhapTuNodes.ts), occupying the BASIC role slot
    // and running through the unified auto-cast scheduler like every other skill.
    // The ONLY difference between Hoa Cau Thuat and the other 4 elements: it is
    // self-learned + placed in the basic role slot (cost 0, see GameManager.chooseCultivationPath()).


    // Three-path design (2026-09-25) -- capstone variance pair bought
    // through the basic-lane nodes fire_basic_hoa_tu_diem /
    // fire_basic_hoa_tan_diem (mutex via excludesNode). Focus raises the
    // single-target hit; spread pays hit power for an AoE edge.
    specializations: [
      {
        id: 'hoa_tu_diem',
        name: 'Tụ Diễm',
        description: 'Hỏa Cầu tụ một điểm — đòn đánh đậm hơn, Thiêu Đốt dễ trúng.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.15,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            // Tam Muoi (D12) -- overrides replace the base effects list,
            // so the window gate is re-declared on each specialization.
            ailmentInteractions: [
              {
                kind: 'add_modifier',
                buffId: 'hoa_an',
                whenSourceBuff: 'tam_muoi',
                modifier: {
                  id: 'tam_muoi_potency',
                  channel: 'potency',
                  operation: 'multiply',
                  value: TAM_MUOI_POTENCY_MULTIPLIER,
                  reapply: 'replace',
                  priority: 0,
                  lifetime: { type: 'buff_lifetime' },
                },
              },
            ],
          },
          { type: 'debuff', buffId: 'hoa_an', ailmentChance: 0.7 },
        ],
      },
      {
        id: 'hoa_tan_diem',
        name: 'Tán Diễm',
        description: 'Hỏa Cầu tán thành vùng — quét nhiều mục tiêu, đòn nhẹ hơn, Thiêu Đốt khó trúng hơn.',
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 0.9,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            ailmentInteractions: [
              {
                kind: 'add_modifier',
                buffId: 'hoa_an',
                whenSourceBuff: 'tam_muoi',
                modifier: {
                  id: 'tam_muoi_potency',
                  channel: 'potency',
                  operation: 'multiply',
                  value: TAM_MUOI_POTENCY_MULTIPLIER,
                  reapply: 'replace',
                  priority: 0,
                  lifetime: { type: 'buff_lifetime' },
                },
              },
            ],
          },
          { type: 'debuff', buffId: 'hoa_an', ailmentChance: 0.45 },
        ],
      },
    ],

    resourceType: 'none',

    // Three-path design (2026-09-25) -- distinct VFX signature per basic
    // (vfxPresetForSkill reads this before the element-generic fallback).
    vfxPresetId: 'hoa_cau_comet',

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

    // Three-path design (2026-09-25) -- capstone variance pair
    // (wood_basic_moc_tu_doc / wood_basic_moc_lan_doc, mutex). Tu Doc
    // deepens the single hit with an extra stack; Lan Doc trades stack
    // depth for an AoE application lane.
    specializations: [
      {
        id: 'moc_tu_doc',
        name: 'Tụ Độc',
        description: 'Độc Chưởng tụ một điểm — đắp thêm 1 tầng Trúng Độc khi trúng.',
        effectsOverride: [
          { type: 'debuff', buffId: 'doc_can', ailmentChance: 1 },
          { type: 'add_stack', buffId: 'doc_can', stacks: 1 },
        ],
      },
      {
        id: 'moc_lan_doc',
        name: 'Lan Độc',
        description: 'Độc Chưởng lan thành vùng — phủ nhiều mục tiêu, nhưng Trúng Độc không còn chắc trúng.',
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [{ type: 'debuff', buffId: 'doc_can', ailmentChance: 0.7 }],
      },
    ],

    // Skill tree redesign (2026-08-21) - root node of the Wood tree, taking
    // BASIC role (see hoa_cau_thuat's note).
    resourceType: 'none',

    vfxPresetId: 'doc_chuong_palm',

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

    // Three-path design (2026-09-25) -- capstone variance pair
    // (water_basic_thuy_ngan_lien / water_basic_thuy_dao_lan, mutex).
    specializations: [
      {
        id: 'thuy_ngan_lien',
        name: 'Ngưng Liễn',
        description: 'Thủy Tiễn ngưng một điểm — đòn đánh đậm hơn, Tê Cóng dễ trúng.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.15,
            components: [{ kind: 'element', element: 'water', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'han_tuc', ailmentChance: 0.65 },
        ],
      },
      {
        id: 'thuy_dao_lan',
        name: 'Đào Lan',
        description: 'Thủy Tiễn vỡ thành làn sóng — quét nhiều mục tiêu, đòn nhẹ hơn, Tê Cóng khó trúng hơn.',
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 0.85,
            components: [{ kind: 'element', element: 'water', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'han_tuc', ailmentChance: 0.4 },
        ],
      },
    ],

    // Skill tree redesign (2026-08-21) - this skill is the ROOT NODE of the
    // element tree (see PhapTuNodes.ts), taking the BASIC role and running through the unified auto-cast scheduler like every skill
    // other. The ONLY difference between Hoa Cau Thuat and the other 4 elements is
    // it is self-learned + placed in the basic role slot (cost 0, see GameManager.chooseCultivationPath()).
    resourceType: 'none',

    vfxPresetId: 'thuy_tien_dart',

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

    // Three-path design (2026-09-25) -- capstone variance pair
    // (metal_basic_kim_tu_phong / metal_basic_kim_tan_phong, mutex).
    specializations: [
      {
        id: 'kim_tu_phong',
        name: 'Tụ Phong',
        description: 'Điểm Kim tụ một điểm — đòn đánh đậm hơn, Xuất Huyết dễ trúng hơn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.25,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'liet_thuong', ailmentChance: 0.45 },
        ],
      },
      {
        id: 'kim_tan_phong',
        name: 'Tán Phong',
        description: 'Điểm Kim tán thành mũi lưỡi — quét nhiều mục tiêu, đòn nhẹ hơn, Xuất Huyết khó trúng hơn.',
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 0.85,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'liet_thuong', ailmentChance: 0.35 },
        ],
      },
    ],

    // Skill tree redesign (2026-08-21) - root node of the Metal tree, taking
    // BASIC role (see hoa_cau_thuat's note).
    resourceType: 'none',

    vfxPresetId: 'diem_kim_point',

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

    // Three-path design (2026-09-25) -- capstone variance pair
    // (earth_basic_tho_tu_nhan / earth_basic_tho_bang_loa, mutex).
    specializations: [
      {
        id: 'tho_tu_nhan',
        name: 'Tụ Nhán',
        description: 'Thổ Cầu nén một điểm — đòn đánh đậm hơn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.15,
            components: [{ kind: 'element', element: 'earth', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'tran_an', ailmentChance: 1 },
        ],
      },
      {
        id: 'tho_bang_loa',
        name: 'Đá Loạn',
        description: 'Thổ Cầu vỡ thành mảnh đá — quét nhiều mục tiêu, đòn nhẹ hơn, Thạch Hóa yếu hơn.',
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 0.9,
            components: [{ kind: 'element', element: 'earth', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'tran_an', ailmentChance: 0.65 },
        ],
      },
    ],

    // Skill tree redesign (2026-08-21) - root node of the Earth tree, taking
    // BASIC role (see hoa_cau_thuat's note).
    resourceType: 'none',

    vfxPresetId: 'tho_cau_boulder',

    buildTag: 'core',


  },

  // ------------------------------------------------------------------
  // Phap Tu Reimagine (2026-09-26 spec) -- the five SPECIALS. Each is a
  // self-targeted Phap Trang ("spell form") cast: it pays a PERCENT of
  // max Linh Luc (see PHAP_TU_TRANG_COST_PERCENT_OF_MAX below -- the
  // resolve seam stamps resourceCostPercentOfMax on the converted def;
  // the Skill record carries resourceType 'mana' with no flat cost) and
  // applies the element's window buff on the caster. No damage, no
  // specializations -- the window's mechanics live in
  // PHAP_TU_WINDOW_LANDED_CONSEQUENCES (below) and the owning basic's
  // ailmentInteractions (fire: Tam Muoi, spec D12).
  // ------------------------------------------------------------------
  {
    id: 'tam_muoi_chan_hoa',
    name: 'Tam Muội Chân Hỏa',
    description:
      'Đốt Linh Lực bật Tam Muội — Hỏa Ấn gieo trong trạng thái này mạnh hơn hẳn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: PHAP_TU_SPECIAL_COOLDOWN_TURNS,
    castTime: PHAP_TU_SPECIAL_CAST_TIME,
    execution: { kind: 'cast_time', castTime: PHAP_TU_SPECIAL_CAST_TIME },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'tam_muoi' }],
    resourceType: 'mana',
  },
  {
    id: 'thanh_tuyen_duong_linh',
    name: 'Thanh Tuyền Dưỡng Linh',
    description:
      'Trả Linh Lực bật Thanh Tuyền — suối thiêng nuôi Pháp Lực hồi nhanh hơn một thời gian.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: PHAP_TU_SPECIAL_COOLDOWN_TURNS,
    castTime: PHAP_TU_SPECIAL_CAST_TIME,
    execution: { kind: 'cast_time', castTime: PHAP_TU_SPECIAL_CAST_TIME },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'thanh_tuyen' }],
    resourceType: 'mana',
  },
  {
    id: 'van_moc_sinh_co',
    name: 'Vạn Mộc Sinh Cơ',
    description:
      'Trả Linh Lực bật Sinh Cơ — đòn Độc Chưởng đầu tiên trong trạng thái gieo một nhịp sinh trưởng chậm lên địch.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: PHAP_TU_SPECIAL_COOLDOWN_TURNS,
    castTime: PHAP_TU_SPECIAL_CAST_TIME,
    execution: { kind: 'cast_time', castTime: PHAP_TU_SPECIAL_CAST_TIME },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'van_moc' }],
    resourceType: 'mana',
  },
  {
    id: 'kim_y_ngung_phong',
    name: 'Kim Ý Ngưng Phong',
    description:
      'Trả Linh Lực bật Kim Ý — đòn Kim dồn lên một mục tiêu tích Kim Liệt, càng đánh càng xuyên.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: PHAP_TU_SPECIAL_COOLDOWN_TURNS,
    castTime: PHAP_TU_SPECIAL_CAST_TIME,
    execution: { kind: 'cast_time', castTime: PHAP_TU_SPECIAL_CAST_TIME },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'kim_y' }],
    resourceType: 'mana',
  },
  {
    id: 'trong_nhac',
    name: 'Trọng Nhạc',
    description:
      'Trả Linh Lực bật Trọng Nhạc — đòn Thổ dồn Trọng Thế lên mục tiêu, tích đủ sẽ đè trễ nhịp địch.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: PHAP_TU_SPECIAL_COOLDOWN_TURNS,
    castTime: PHAP_TU_SPECIAL_CAST_TIME,
    execution: { kind: 'cast_time', castTime: PHAP_TU_SPECIAL_CAST_TIME },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'trong_nhac' }],
    resourceType: 'mana',
  },
]

/** Trong The stacks consumed per delay proc (spec D11 authored T). Shared
    with the marker's maxStacks cap in PhapTuTrangBuffs.ts. */
export { TRONG_THE_THRESHOLD } from '../buff/PhapTuTrangBuffs'

// ---------------------------------------------------------------------------
// Turn-skill authored lanes (spec D8/D11/D15). `landedConsequences` is an
// ENGINE-owned TurnSkillDefinition field: the resolve seam attaches the
// WINDOW table to each element basic's converted def, and
// buildPhapTheVariant clones the def then appends the PHAP THE table.
// `loop_target` inside = the hit's target (the primary hit's target for
// these lanes); `self` = the caster. `stacks_below`, `other_enemy` and
// `other_enemies` are ENGINE-owned primitives named by the spec.
// ---------------------------------------------------------------------------

/** Window-marker ops -- each gated on the caster holding the Trang buff
    (`stacks_at_least self <window>`), so the same def is inert outside
    the window on both normal and empowered casts. Fire carries none:
    Tam Muoi rides the fire basic's ailmentInteractions (spec D12). */
export const PHAP_TU_WINDOW_LANDED_CONSEQUENCES: Record<
  ElementType,
  readonly AuthoredSkillOperation[]
> = {
  fire: [],
  water: [], // Thanh Tuyen is a regen window -- no target markers.
  wood: [
    // Van Moc (design sec.52-54): the first own-source landed Moc basic
    // plants Sinh Co on that target -- once per window via the self-side
    // sinh_co_chu latch. The marker's periodic_growth grant grows the
    // caster's Doc Can instance on its next natural tick, then consumes.
    {
      type: 'if',
      condition: {
        kind: 'stacks_at_least',
        target: 'self',
        definitionId: 'van_moc',
        stacks: 1,
      },
      then: [
        {
          type: 'if',
          condition: {
            kind: 'stacks_below',
            target: 'self',
            definitionId: 'sinh_co_chu',
            max: 1,
          },
          then: [
            {
              type: 'apply_buff',
              target: 'loop_target',
              definitionId: 'sinh_co',
              stacks: 1,
            },
            {
              type: 'apply_buff',
              target: 'self',
              definitionId: 'sinh_co_chu',
              stacks: 1,
            },
          ],
        },
      ],
    },
  ],
  metal: [
    // Kim Y (design sec.57-59): each landed metal basic adds one Kim Liet
    // to the struck target; the primary hit's penetrationFromStacks reads
    // the stack count present BEFORE this landed lane ran.
    // TODO(coordinator): verify engine read ordering -- if
    // penetrationFromStacks evaluates the pre-hit state this lane stays;
    // if it reads post-apply, move the marker add behind a landed latch.
    {
      type: 'if',
      condition: {
        kind: 'stacks_at_least',
        target: 'self',
        definitionId: 'kim_y',
        stacks: 1,
      },
      then: [
        {
          type: 'apply_buff',
          target: 'loop_target',
          definitionId: 'kim_liet',
          stacks: 1,
        },
      ],
    },
  ],
  earth: [
    // Trong Nhac (design sec.64-66): stack up Trong The on the struck
    // primary target until it has been delayed once (trong_the_da_bi
    // latch); at the threshold consume ALL stacks and push the target's
    // gauge back once. Secondary shockwave hits never run this lane.
    {
      type: 'if',
      condition: {
        kind: 'stacks_at_least',
        target: 'self',
        definitionId: 'trong_nhac',
        stacks: 1,
      },
      then: [
        {
          type: 'if',
          condition: {
            kind: 'stacks_below',
            target: 'loop_target',
            definitionId: 'trong_the_da_bi',
            max: 1,
          },
          then: [
            {
              type: 'apply_buff',
              target: 'loop_target',
              definitionId: 'trong_the',
              stacks: 1,
            },
          ],
        },
        {
          type: 'if',
          condition: {
            kind: 'stacks_at_least',
            target: 'loop_target',
            definitionId: 'trong_the',
            stacks: TRONG_THE_THRESHOLD,
          },
          then: [
            {
              type: 'consume_buff_stacks',
              selector: {
                kind: 'identity',
                definitionId: 'trong_the',
                source: 'self',
                target: 'loop_target',
              },
              stacks: 'all',
            },
            {
              type: 'push_gauge',
              target: 'loop_target',
              fractionOfMax: -TRONG_NHAC_DELAY_GAUGE_FRACTION,
            },
            {
              type: 'apply_buff',
              target: 'loop_target',
              definitionId: 'trong_the_da_bi',
              stacks: 1,
            },
          ],
        },
      ],
    },
  ],
}

/** Phap The rider ops -- appended to the empowered variant's landed lane
    by buildPhapTheVariant (spec D15; they sit inside the primary hit's
    landed gate, so a missed cast never mints a rider). Wood and metal
    riders are payload edits owned by the variant builder (D6 stack bump,
    D7 flat pierce) -- the authored constants above carry their numbers. */
export const PHAP_TU_PHAP_THE_LANDED_CONSEQUENCES: Record<
  ElementType,
  readonly AuthoredSkillOperation[]
> = {
  // Hoa (D3): pulse the pre-existing own-source Hoa An once -- authored
  // order lands this BEFORE the adapter-emitted apply, so only instances
  // that existed before this cast tick.
  fire: [
    {
      type: 'trigger_buff_periodic',
      selector: {
        kind: 'identity',
        definitionId: 'hoa_an',
        source: 'self',
        target: 'loop_target',
      },
    },
  ],
  // Thuy (D4): one secondary water hit on the first OTHER living enemy;
  // it may apply the element ailment via its own landed lane.
  water: [
    {
      type: 'if',
      condition: { kind: 'target_hit_landed', target: 'loop_target' },
      then: [
        {
          type: 'deal_damage',
          target: 'other_enemy',
          oncePerCast: true,
          coefficient: THUY_PHAP_THE_SECONDARY_COEFFICIENT,
          components: [{ kind: 'element', element: 'water', ratio: 1 }],
          scaling: {
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          onLanded: [
            {
              type: 'apply_buff',
              target: 'loop_target',
              definitionId: 'han_tuc',
              chance: 0.5,
            },
          ],
        },
      ],
    },
  ],
  wood: [], // D6: variant builder clones the doc_can apply with +1 stack.
  metal: [], // D7: variant's primary hit carries KIM_PHAP_THE_PENETRATION_BONUS.
  // Tho (D5): shockwave every other enemy at ~0.4x; carries no ailment
  // and no Trong The (that lane gates on the primary hit only).
  earth: [
    {
      type: 'deal_damage',
      target: 'other_enemies',
      oncePerCast: true,
      coefficient: THO_PHAP_THE_SHOCKWAVE_COEFFICIENT,
      components: [{ kind: 'element', element: 'earth', ratio: 1 }],
      scaling: {
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
    },
  ],
}
