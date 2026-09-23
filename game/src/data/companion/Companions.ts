// Companions (Companion Roster spec, 2026-09-05; MVP roster pass
// 2026-09-12) - recruitable gacha allies with a FIXED skill kit (no
// per-character Ngu Hanh node-tree/role picks) and NO equipment - stats
// scale purely from grade + realmLevel + constellationRank (see
// companionStatsAt in core/companion/CompanionProgression.ts).
// Reuses ItemGrade (Hoang/Huyen/Dia/Thien/Tien Chat) as the rarity
// ladder - the SAME 5-step scale as Equipment/Pill/Talisman/Formation,
// unrelated to the 10-step ProfessionGrade.
//
// MVP roster (design spec section 8): 4 hoang / 3 huyen / 2 dia /
// 1 thien / 0 tien - tien stays in COMPANION_BASE_RATES but is filtered
// out of effectiveCompanionRates until a tien definition exists.
// P7-M-G (beta roster): +than_nong (huyen healer) and +khai_minh (dia
// buffer) take the catalog to 4/4/3/1/0. The existing ten stay in the
// catalog as future content - owned instances, save validation, combat
// build and art still resolve them - but Beta ACQUISITION (pull,
// exchange, Duyen Phan rows) reads only BETA_COMPANIONS below.
// growthRate (hoang 0.04 / huyen 0.05 / dia 0.06 / thien 0.08) and the
// unlockThresholds below are starting balance constants for a later tune
// pass: higher grades grow faster AND unlock earlier (hoang specials at
// Luyen Khi, huyen/dia/thien specials mid-Pham Nhan; ultimates at Truc
// Co+). Every skill is plain TurnSkillDefinition content - damage
// shapes, ailments, self-buffs, detonate, leech, charge - no id-keyed
// engine branches (A8). Display names for the skill ids live in
// data/skill/TurnSkillDisplayMeta.ts (the HUD meta layer).
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

export interface CompanionBaseStats {
  maxHp: number
  might: number
  speed: number
}

export type CompanionSkillSlot = 'basic' | 'special' | 'ultimate'

/** Whitelisted skill overrides - id/targeting may NOT be overridden (A8). */
export interface CompanionSkillOverride {
  cooldownTurns?: number
  damageMultiplierPercent?: number   // multiplies damage.multiplier, e.g. 20 = x1.2
  healPercentOfDamage?: number
}

export type ConstellationPerk =
  | { atRank: number; kind: 'stat'; stat: keyof CompanionBaseStats; percent?: number; flat?: number }
  | { atRank: number; kind: 'skill_override'; slot: CompanionSkillSlot; overrides: CompanionSkillOverride }

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade
  growthRate: number                       // stat multiplier per global cultivation level
  unlockThresholds: {                      // realm gate per slot (compare vs instance realm/tier)
    special?: { realmId: string; realmLevel: number }
    ultimate?: { realmId: string; realmLevel: number }
  }
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
  constellationPerks?: ConstellationPerk[]
}

export interface CompanionInstance {
  instanceId: string          // stable identity - crypto.randomUUID(), never array index
  definitionId: string
  realmId: string             // starts 'mortal'
  realmLevel: number          // tier within realmId (1..realm.maxLevel)
  exp: number                 // exp banked within current tier
  constellationRank: number   // 0..6
}

// ---------------------------------------------------------------------------
// Hoang (4) - growthRate 0.04. Lean kits: a themed basic, one special that
// opens at Luyen Khi, one ultimate at Truc Co.
// ---------------------------------------------------------------------------

export const COMPANIONS: readonly CompanionDefinition[] = [
  {
    id: 'ho_ly_tinh',
    name: 'Hồ Ly Tinh',
    grade: 'hoang',
    growthRate: 0.04,
    unlockThresholds: {
      special: { realmId: 'qi_refining', realmLevel: 1 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 1 },
    },
    baseStats: { maxHp: 90, might: 12, speed: 110 },
    // Fast foxfire caster - claws physically, then burns with Ho Hoa.
    basic: {
      id: 'ho_ly_tinh_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      presetId: 'claw',
    },
    special: {
      id: 'ho_ly_tinh_special',
      cooldownTurns: 3,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        multiplier: 1.6,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'hoa_an', chance: 0.5 },
      presetId: 'fire_burst',
    },
    ultimate: {
      id: 'ho_ly_tinh_ultimate',
      cooldownTurns: 7,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        multiplier: 2.8,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'hoa_an', chance: 1, stacks: 2 },
      presetId: 'fire_burst',
    },
  },

  {
    id: 'khai_son_luc_si',
    name: 'Khai Sơn Lực Sĩ',
    grade: 'hoang',
    growthRate: 0.04,
    unlockThresholds: {
      special: { realmId: 'qi_refining', realmLevel: 4 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 6 },
    },
    baseStats: { maxHp: 150, might: 10, speed: 95 },
    // Slow frontline bruiser - stone-splitting blows petrify and stun.
    basic: {
      id: 'khai_son_luc_si_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      presetId: 'slash',
    },
    special: {
      id: 'khai_son_luc_si_special',
      cooldownTurns: 4,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'square', laneRadius: 1 },
      appliesAilment: { buffDefinitionId: 'tran_an', chance: 0.4 },
      presetId: 'earth_shockwave',
    },
    ultimate: {
      id: 'khai_son_luc_si_ultimate',
      cooldownTurns: 9,
      damage: { kind: 'physical', multiplier: 3.2 },
      targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
      appliesAilment: { buffDefinitionId: 'choang', chance: 0.35 },
      presetId: 'boss_ground_slam',
    },
  },

  {
    id: 'linh_hac',
    name: 'Linh Hạc',
    grade: 'hoang',
    growthRate: 0.04,
    unlockThresholds: {
      special: { realmId: 'qi_refining', realmLevel: 6 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 4 },
    },
    baseStats: { maxHp: 80, might: 9, speed: 120 },
    // Spirit crane - fastest hoang pick; frosty wing-beats chill whole rows.
    basic: {
      id: 'linh_hac_basic',
      cooldownTurns: 0,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        multiplier: 1,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'lam_cham', chance: 0.3 },
      presetId: 'wind_blade',
    },
    special: {
      id: 'linh_hac_special',
      cooldownTurns: 4,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        multiplier: 1.5,
      },
      targeting: { shape: 'row' },
      appliesAilment: { buffDefinitionId: 'han_khi', chance: 1 },
      presetId: 'water_surge',
    },
    ultimate: {
      id: 'linh_hac_ultimate',
      cooldownTurns: 8,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        multiplier: 2.4,
      },
      targeting: { shape: 'all_lanes', columnRadius: 1 },
      appliesAilment: { buffDefinitionId: 'lam_cham', chance: 1 },
      presetId: 'water_surge',
    },
  },

  {
    id: 'duoc_dong_tu',
    name: 'Dược Đồng Tử',
    grade: 'hoang',
    growthRate: 0.04,
    unlockThresholds: {
      special: { realmId: 'qi_refining', realmLevel: 2 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 1 },
    },
    baseStats: { maxHp: 110, might: 8, speed: 100 },
    // Alchemy boy - poisons with herbs, then detonates the Trung Doc stacks.
    basic: {
      id: 'duoc_dong_tu_basic',
      cooldownTurns: 0,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        multiplier: 1,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'doc_can', chance: 0.5 },
      presetId: 'wood_spikes',
    },
    special: {
      id: 'duoc_dong_tu_special',
      cooldownTurns: 4,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        multiplier: 1.4,
      },
      targeting: { shape: 'square', laneRadius: 1 },
      appliesAilment: { buffDefinitionId: 'doc_can', chance: 1 },
      presetId: 'wood_spikes',
    },
    // Van Doc Quy Tong: detonate - consumes the target's Trung Doc stacks
    // for flat true damage per stack on top of the hit.
    ultimate: {
      id: 'duoc_dong_tu_ultimate',
      cooldownTurns: 7,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        multiplier: 1.8,
      },
      targeting: { shape: 'single' },
      consumesAilmentId: 'doc_can',
      damagePerStack: 15,
      presetId: 'wood_spikes',
    },
  },

  // -------------------------------------------------------------------------
  // Huyen (3) - growthRate 0.05. Specials open mid-Pham Nhan, earlier than
  // hoang's Luyen Khi gate; ultimates still Truc Co+.
  // -------------------------------------------------------------------------

  {
    id: 'van_du_kiem_khach',
    name: 'Vân Du Kiếm Khách',
    grade: 'huyen',
    growthRate: 0.05,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 10 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 1 },
    },
    baseStats: { maxHp: 120, might: 15, speed: 108 },
    // Wandering swordsman - clean physical lines, a charged draw-cut finish.
    basic: {
      id: 'van_du_kiem_khach_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1.1 },
      targeting: { shape: 'single' },
      presetId: 'slash',
    },
    special: {
      id: 'van_du_kiem_khach_special',
      cooldownTurns: 4,
      damage: { kind: 'physical', multiplier: 1.9 },
      targeting: { shape: 'line' },
      presetId: 'metal_slash',
    },
    // Tuyet Kiem Nhat Thu: two-turn charge, then the resolving slash
    // (generic chargeTurns primitive).
    ultimate: {
      id: 'van_du_kiem_khach_ultimate',
      cooldownTurns: 6,
      chargeTurns: 2,
      damage: { kind: 'physical', multiplier: 3.6 },
      targeting: { shape: 'single' },
      presetId: 'slash',
    },
  },

  {
    id: 'thuy_linh_xa',
    name: 'Thủy Linh Xà',
    grade: 'huyen',
    growthRate: 0.05,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 12 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 3 },
    },
    baseStats: { maxHp: 135, might: 14, speed: 104 },
    // Water spirit serpent - chilling bites, column floods, tidal rows.
    basic: {
      id: 'thuy_linh_xa_basic',
      cooldownTurns: 0,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        multiplier: 1,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'han_tuc', chance: 0.4 },
      presetId: 'claw',
    },
    special: {
      id: 'thuy_linh_xa_special',
      cooldownTurns: 4,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        multiplier: 1.7,
      },
      targeting: { shape: 'column' },
      appliesAilment: { buffDefinitionId: 'lam_cham', chance: 0.8 },
      presetId: 'water_surge',
    },
    ultimate: {
      id: 'thuy_linh_xa_ultimate',
      cooldownTurns: 8,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        multiplier: 3,
      },
      targeting: { shape: 'row' },
      appliesAilments: [
        { buffDefinitionId: 'han_khi', chance: 1, stacks: 2 },
        { buffDefinitionId: 'han_tuc', chance: 0.5 },
      ],
      presetId: 'water_surge',
    },
  },

  {
    id: 'thiet_y_tang',
    name: 'Thiết Y Tăng',
    grade: 'huyen',
    growthRate: 0.05,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 14 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 5 },
    },
    baseStats: { maxHp: 190, might: 12, speed: 92 },
    // Iron-robe monk - tanks up with Kim Giap, then a palm that weakens
    // every enemy caught in the square.
    basic: {
      id: 'thiet_y_tang_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      presetId: 'slash',
    },
    // Kim Cang Ho The: self-buff stance, no damage.
    special: {
      id: 'thiet_y_tang_special',
      cooldownTurns: 5,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'kim_giap', target: 'self' }],
    },
    ultimate: {
      id: 'thiet_y_tang_ultimate',
      cooldownTurns: 9,
      damage: { kind: 'physical', multiplier: 2.6 },
      targeting: { shape: 'square', laneRadius: 1 },
      appliesBuffs: [{ definitionId: 'uy_ap', target: 'action_targets' }],
      presetId: 'holy_radiance',
    },
  },

  // -------------------------------------------------------------------------
  // Dia (2) - growthRate 0.06. Specials open early Pham Nhan; Cung Menh perks
  // at ranks 2/4/6 mix raw stats with skill overrides.
  // -------------------------------------------------------------------------

  {
    id: 'kim_quang_thanh_nhan',
    name: 'Kim Quang Thánh Nhân',
    grade: 'dia',
    growthRate: 0.06,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 6 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 1 },
    },
    baseStats: { maxHp: 160, might: 21, speed: 106 },
    // Golden-light sage - metal sword-light that bleeds and sunders armor.
    basic: {
      id: 'kim_quang_thanh_nhan_basic',
      cooldownTurns: 0,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        multiplier: 1.2,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'liet_thuong', chance: 0.4 },
      presetId: 'metal_slash',
    },
    special: {
      id: 'kim_quang_thanh_nhan_special',
      cooldownTurns: 4,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        multiplier: 2.1,
      },
      targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
      appliesAilment: { buffDefinitionId: 'liet_thuong', chance: 0.8 },
      presetId: 'metal_slash',
    },
    // Kim Quang Pha Giap: a wide blade strip that cracks metal resistance
    // on everything it touches (giap_ran applies to all affected targets).
    ultimate: {
      id: 'kim_quang_thanh_nhan_ultimate',
      cooldownTurns: 9,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        multiplier: 3.4,
      },
      targeting: { shape: 'all_lanes', columnRadius: 2 },
      appliesBuffs: [{ definitionId: 'giap_ran', target: 'action_targets' }],
      presetId: 'metal_slash',
    },
    constellationPerks: [
      { atRank: 2, kind: 'stat', stat: 'might', percent: 15 },
      { atRank: 4, kind: 'skill_override', slot: 'special', overrides: { cooldownTurns: 2 } },
      { atRank: 6, kind: 'skill_override', slot: 'ultimate', overrides: { damageMultiplierPercent: 25 } },
    ],
  },

  {
    id: 'huyen_vu',
    name: 'Huyền Vũ',
    grade: 'dia',
    growthRate: 0.06,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 8 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 5 },
    },
    baseStats: { maxHp: 260, might: 14, speed: 90 },
    // Black-tortoise guardian - petrifying slams, rooting earth, then a
    // Dia Tru bulwark stance as its ultimate.
    basic: {
      id: 'huyen_vu_basic',
      cooldownTurns: 0,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        multiplier: 1,
      },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'tran_an', chance: 0.3 },
      presetId: 'earth_shockwave',
    },
    special: {
      id: 'huyen_vu_special',
      cooldownTurns: 5,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        multiplier: 1.6,
      },
      targeting: { shape: 'cross', laneRadius: 1 },
      appliesAilment: { buffDefinitionId: 'troi_chan', chance: 0.5 },
      presetId: 'earth_shockwave',
    },
    ultimate: {
      id: 'huyen_vu_ultimate',
      cooldownTurns: 8,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'dia_tru', target: 'self' }],
      presetId: 'earth_shockwave',
    },
    constellationPerks: [
      { atRank: 2, kind: 'stat', stat: 'maxHp', percent: 20 },
      { atRank: 4, kind: 'skill_override', slot: 'special', overrides: { cooldownTurns: 3 } },
      { atRank: 6, kind: 'stat', stat: 'might', flat: 8 },
    ],
  },

  // -------------------------------------------------------------------------
  // Thien (1) - growthRate 0.08. The MVP chase pull: primordial damage that
  // ignores resistances, and the earliest unlocks in the roster.
  // -------------------------------------------------------------------------

  {
    id: 'cuu_thien_huyen_nu',
    name: 'Cửu Thiên Huyền Nữ',
    grade: 'thien',
    growthRate: 0.08,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 4 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 10 },
    },
    baseStats: { maxHp: 220, might: 27, speed: 112 },
    // Mystic Maiden of the Nine Heavens - starfall sword-light in rows,
    // a sky-fall ultimate across three lanes that leeches back to her.
    basic: {
      id: 'cuu_thien_huyen_nu_basic',
      cooldownTurns: 0,
      damage: { kind: 'primordial', multiplier: 1.3 },
      targeting: { shape: 'single' },
      presetId: 'holy_radiance',
    },
    special: {
      id: 'cuu_thien_huyen_nu_special',
      cooldownTurns: 4,
      damage: { kind: 'primordial', multiplier: 2.4 },
      targeting: { shape: 'line' },
      appliesAilment: { buffDefinitionId: 'uy_ap', chance: 0.5 },
      presetId: 'holy_radiance',
    },
    ultimate: {
      id: 'cuu_thien_huyen_nu_ultimate',
      cooldownTurns: 10,
      damage: { kind: 'primordial', multiplier: 4.2 },
      targeting: { shape: 'all_lanes', columnRadius: 3 },
      healPercentOfDamage: 0.3,
      presetId: 'holy_radiance',
    },
    constellationPerks: [
      { atRank: 2, kind: 'stat', stat: 'speed', flat: 15 },
      { atRank: 4, kind: 'skill_override', slot: 'basic', overrides: { damageMultiplierPercent: 20 } },
      { atRank: 6, kind: 'skill_override', slot: 'ultimate', overrides: { damageMultiplierPercent: 30 } },
    ],
  },

  // -------------------------------------------------------------------------
  // P7-M-G Beta roster (2) - the support kits. than_nong heals through
  // hpRegenPerTurn stat buffs (allies recover on their own turn cadence);
  // khai_minh reinforces the party and wards it through the proven
  // son_nhac_ho_the externalWardGrant channel. First companion users of
  // allies_except_self - all buffs resolve in BUFF_REGISTRY via
  // data/buff/CompanionBuffs.ts.
  // -------------------------------------------------------------------------

  {
    id: 'than_nong',
    name: 'Thần Nông',
    grade: 'huyen',
    growthRate: 0.05,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 12 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 3 },
    },
    baseStats: { maxHp: 105, might: 9, speed: 102 },
    // The Divine Farmer - wood herb strikes on the basic, then herbal
    // heals that keep working on each ally's own turn.
    basic: {
      id: 'than_nong_basic',
      cooldownTurns: 0,
      damage: {
        kind: 'elemental',
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        multiplier: 0.9,
      },
      targeting: { shape: 'single' },
      presetId: 'wood_spikes',
    },
    special: {
      id: 'than_nong_hoi_phuc_thuat',
      cooldownTurns: 4,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'than_nong_hoi_phuc', target: 'allies_except_self' }],
      presetId: 'holy_radiance',
    },
    ultimate: {
      id: 'than_nong_than_dang',
      cooldownTurns: 8,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'than_nong_than_dang_hoi_phuc', target: 'allies_except_self' }],
      presetId: 'holy_radiance',
    },
  },

  {
    id: 'khai_minh',
    name: 'Khai Minh',
    grade: 'dia',
    growthRate: 0.06,
    unlockThresholds: {
      special: { realmId: 'mortal', realmLevel: 8 },
      ultimate: { realmId: 'foundation_establishment', realmLevel: 5 },
    },
    baseStats: { maxHp: 180, might: 12, speed: 94 },
    // The nine-headed guardian of Kunlun - claws on the basic, then
    // party reinforcement and a sheltering ward over every ally.
    basic: {
      id: 'khai_minh_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      presetId: 'claw',
    },
    special: {
      id: 'khai_minh_ho_ve_thuat',
      cooldownTurns: 5,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'khai_minh_ho_ve', target: 'allies_except_self' }],
      presetId: 'holy_radiance',
    },
    ultimate: {
      id: 'khai_minh_thanh_an',
      cooldownTurns: 8,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuffs: [
        {
          definitionId: 'khai_minh_thanh_ho',
          target: 'allies_except_self',
          externalWardGrant: { sourceMaxHpRatio: 0.25 },
        },
      ],
      presetId: 'holy_radiance',
    },
    constellationPerks: [
      { atRank: 2, kind: 'stat', stat: 'maxHp', percent: 15 },
      { atRank: 4, kind: 'skill_override', slot: 'special', overrides: { cooldownTurns: 4 } },
      { atRank: 6, kind: 'stat', stat: 'might', flat: 8 },
    ],
  },
]

// ---------------------------------------------------------------------------
// P7-M-G Beta acquisition pool - the ONLY definitions pull/exchange/UI may
// hand out in Beta. COMPANIONS above stays the full content catalog: the
// existing ten are "future content" (owned instances, save validation,
// combat build and art keep resolving them). Derived - never duplicated
// def objects - so BETA_COMPANION_IDS stays the single source of truth.
// ---------------------------------------------------------------------------

export const BETA_COMPANION_IDS: readonly string[] = ['than_nong', 'khai_minh']

export const BETA_COMPANIONS: readonly CompanionDefinition[] = COMPANIONS.filter((definition) =>
  BETA_COMPANION_IDS.includes(definition.id),
)

// M-F-COMPANION-GIFT - persisted mail/gift record on PlayerData
// (core/player/Player.ts). `id` doubles as the issuing moment's id -
// dedupe key and provenance in one field; `claimed` is the one-way
// consumed marker.
export interface CompanionGiftRecord {
  id: string
  definitionId: string
  claimed: boolean
}

// Beta gift-acquisition authority: ONLY these catalog members may be
// issued or claimed through the mail/gift channel. Same members as
// BETA_COMPANION_IDS but a distinct axis - pull-pool content vs
// gift-grant authority (a future pool may reopen with a different set).
export const BETA_COMPANION_GIFT_IDS = ['than_nong', 'khai_minh'] as const

/**
 * Two-conjunct predicate (C2C round-53): the id must be declared in the
 * gift authority AND resolve in the real catalog. A typo'd or retired
 * list entry is itself non-giftable, so no unclaimable record can be
 * issued, claimed, or persisted - registry integrity is separately
 * pinned by test (BETA_COMPANION_GIFT_IDS subset of COMPANIONS).
 */
export function isBetaCompanionGift(definitionId: string): boolean {
  return (
    (BETA_COMPANION_GIFT_IDS as readonly string[]).includes(definitionId) &&
    COMPANIONS.some((definition) => definition.id === definitionId)
  )
}
