import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'
import type { EnemySpecialAttack } from '../../core/enemy/Enemy'
import type { TribulationPhase, BossEnrage } from '../../core/enemy/TribulationPhase'

// defineEnemy() nhận statsInput gọn (~10-13 field, xem EnemyStatInput.ts)
// thay vì phải khai đủ 41 field Stats như trước — đúng khuyến nghị
// Last Epoch, quái thường không cần bộ stat đầy đủ như player.
const ENEMY_DEFINITIONS: Enemy[] = [
  defineEnemy({
    id: 'wild_wolf',

    name: 'Dã Lang',

    level: 1,

    realmId: 'qi_refining',

    lane: 'ground',

    // "tunghematandsuch" pass (2026-08-14) — family chỉ còn ý nghĩa
    // LABEL (nhóm hình ảnh/lore), không còn quyết định material riêng.
    family: 'wolf',

    statsInput: {
      maxHp: 200,
      attack: 20,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 10,

      // Mãnh thú hoang dã, thiên Mộc/Thổ — có chút kháng 2 hành đó.
      resistances: { wood: 5, earth: 5 },
      elemental: { element: 'wood', power: 8 },
    },

    rewards: {
      techniqueInsight: 20,
      spiritStone: 5,

      itemDrops: [
        // Đột Phá Trúc Cơ (Phase 6) — loot vô thưởng vô phạt (mục 14
        // spec `breakthrough`), chance thấp cố ý.
        { kind: 'material', itemId: 'cultivator_diary', amount: 1, chance: 0.07 },
      ],
    },
  }),

  defineEnemy({
    id: 'bandit',

    name: 'Sơn Tặc',

    level: 2,

    realmId: 'qi_refining',

    lane: 'ground',

    family: 'bandit',

    statsInput: {
      maxHp: 350,
      attack: 35,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 20,
      evasionRate: 15,

      // Dùng binh khí kim loại — có chút kháng Kim nhờ giáp trụ.
      resistances: { metal: 8 },
      elemental: { element: 'metal', power: 10 },
    },

    rewards: {
      techniqueInsight: 40,
      spiritStone: 10,

      itemDrops: [
        { kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 },
        // Tăng tỷ lệ giai đoạn test (PLAN HOÀN CHỈNH mục 1) — trước
        // 0.05/0.2/0.5, quá thấp để kiểm thử weapon drop thực tế.
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.15 },
      ],
    },

    // Bản Elite ("Sơn Tặc Đầu Lĩnh", xem Stages.ts's eliteChance) —
    // thưởng đậm hơn hẳn + cơ hội rơi Phá Cảnh Tâm Pháp.
    eliteRewards: {
      techniqueInsight: 200,
      spiritStone: 60,

      itemDrops: [
        { kind: 'material', itemId: 'qi_refining_ore_decade', amount: 3, chance: 0.6 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.35 },
        { kind: 'technique', itemId: 'van_kiem_quyet', chance: 0.2 },
      ],
    },

    // Core Loop Foundation checklist (Mục BOSS) — tier RIÊNG, tách
    // hẳn khỏi eliteRewards: thưởng đậm hơn nhiều + GUARANTEED (chance
    // 1.0) Phá Cảnh Tâm Pháp, vì Boss KHÔNG spawn ngẫu nhiên (luôn là
    // quái cuối stage có bossEnemyId, xem data/stage/Stages.ts) — hiếm
    // hơn Elite nên xứng đáng phần thưởng chắc chắn thay vì roll %.
    bossRewards: {
      techniqueInsight: 500,
      spiritStone: 150,

      itemDrops: [
        { kind: 'material', itemId: 'qi_refining_ore_decade', amount: 6, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.75 },
        { kind: 'technique', itemId: 'van_kiem_quyet', chance: 1 },
        // Đột Phá Trúc Cơ (Phase 3) — 0.01%, mức thấp nhất từng có
        // trong codebase, có chủ đích (xem data/materials/materials.ts's
        // great_dao_seed).
        { kind: 'material', itemId: 'great_dao_seed', amount: 1, chance: 0.0001 },
      ],
    },
  }),

  defineEnemy({
    id: 'mountain_hawk',

    name: 'Ó Núi',

    level: 2,

    realmId: 'qi_refining',

    lane: 'air',

    family: 'hawk',

    // Core Loop Foundation checklist (Mục MONSTER) — Ó Núi bay lượn
    // trên cao, giữ khoảng cách thay vì lao vào cận chiến.
    archetype: 'ranged',

    statsInput: {
      maxHp: 150,
      attack: 25,
      attackSpeed: 7,
      attackRangeRanks: 5,
      criticalRate: 0.12,
      criticalDamage: 2,
      armor: 8,
      // Bay lượn, khó trúng hơn quái mặt đất thường.
      evasionRate: 45,

      // Móng vuốt sắc — thiên Kim.
      resistances: { metal: 10 },
      elemental: { element: 'metal', power: 9 },
    },

    rewards: {
      techniqueInsight: 30,
      spiritStone: 8,
    },
  }),

  defineEnemy({
    id: 'giant_earthworm',

    name: 'Trùn Đất',

    level: 2,

    realmId: 'qi_refining',

    lane: 'underground',

    family: 'earthworm',

    // Core Loop Foundation checklist (Mục MONSTER) — lặn xuống đất
    // rồi trồi lên tấn công, có "khoảng lặng" telegraph trước đòn.
    archetype: 'caster',

    statsInput: {
      maxHp: 450,
      attack: 30,
      attackSpeed: 3,
      attackRangeRanks: 5,
      criticalRate: 0.02,
      criticalDamage: 1.5,
      armor: 25,
      // Tank chậm, gần như không né được.
      evasionRate: 8,

      // Da dày, thiên Thổ đậm.
      resistances: { earth: 15 },
      elemental: { element: 'earth', power: 9 },
    },

    rewards: {
      techniqueInsight: 35,
      spiritStone: 8,

      itemDrops: [
        // Đột Phá Trúc Cơ (Phase 6) — loot vô thưởng vô phạt (mục 14
        // spec `breakthrough`), chance thấp cố ý.
        { kind: 'material', itemId: 'stele_fragment', amount: 1, chance: 0.07 },
      ],
    },
  }),

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — 18 quái MỚI, đúng
  // 2 species/tầng (1 "beast" thường + 1 "boss-eligible" tái dùng làm
  // bossEnemyId của stage, y hệt pattern wild_wolf/bandit hiện có).
  // Ngũ Hành Tương Sinh: Mộc(t1-2)→Hỏa(t3-4)→Thổ(t5-6)→Kim(t7-8)→
  // Thủy(t9-10). Tầng chẵn = species y hệt tầng lẻ trong CÙNG cặp,
  // chỉ + tiền tố "Hung " (hung dữ hơn) + stat mạnh hơn theo công thức (xem
  // data/stage/Stages.ts's comment đầu file cho công thức đầy đủ) —
  // KHÔNG tự thêm từ chỉ đẳng cấp (Vương/Chúa/Đầu Lĩnh) vào tên, engine
  // đã tự thêm "Tinh Anh "/"Đại Vương " lúc spawn (xem createEliteVariant/
  // createBossVariant ở trên).

  // --- Tầng 2 (Mộc, Thanh Vân Lâm) ---
  defineEnemy({
    id: 'ferocious_wild_wolf',
    name: 'Hung Dã Lang',
    level: 2,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'wolf',
    statsInput: {
      maxHp: 235,
      attack: 23,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.07,
      criticalDamage: 2.1,
      armor: 14,
      resistances: { wood: 8, earth: 5 },
      elemental: { element: 'wood', power: 10 },
    },
    rewards: {
      techniqueInsight: 25,
      spiritStone: 6,
    },
  }),

  defineEnemy({
    id: 'forest_fiend',
    name: 'Lâm Yêu',
    level: 2,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'forest_fiend',
    statsInput: {
      maxHp: 375,
      attack: 32,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.08,
      criticalDamage: 2,
      armor: 18,
      evasionRate: 15,
      resistances: { wood: 12 },
      elemental: { element: 'wood', power: 12 },
    },
    rewards: {
      techniqueInsight: 50,
      spiritStone: 12,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 250,
      spiritStone: 72,
    },
    bossRewards: {
      techniqueInsight: 625,
      spiritStone: 180,
    },
  }),

  // --- Tầng 3 (Hỏa, Xích Diễm Cốc) ---
  defineEnemy({
    id: 'flame_fox',
    name: 'Viêm Hồ',
    level: 3,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'ranged',
    family: 'flame_fox',
    statsInput: {
      maxHp: 275,
      attack: 27,
      attackSpeed: 6,
      attackRangeRanks: 5,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 16,
      evasionRate: 35,
      resistances: { fire: 10 },
      elemental: { element: 'fire', power: 10 },
    },
    rewards: {
      techniqueInsight: 30,
      spiritStone: 7,
    },
  }),

  defineEnemy({
    id: 'magma_boar',
    name: 'Nham Trư',
    level: 3,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'magma_boar',
    statsInput: {
      maxHp: 440,
      attack: 38,
      attackSpeed: 4,
      attackRangeRanks: 1,
      criticalRate: 0.04,
      criticalDamage: 1.8,
      armor: 21,
      evasionRate: 10,
      resistances: { fire: 15, earth: 10 },
      elemental: { element: 'fire', power: 12 },
    },
    rewards: {
      techniqueInsight: 55,
      spiritStone: 14,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 275,
      spiritStone: 84,
    },
    bossRewards: {
      techniqueInsight: 690,
      spiritStone: 210,
      itemDrops: [{ kind: 'equipment', itemId: 'base_quan', chance: 0.4 }],
    },
  }),

  // --- Tầng 4 (Hỏa, Xích Diễm Lĩnh) ---
  defineEnemy({
    id: 'ferocious_flame_fox',
    name: 'Hung Viêm Hồ',
    level: 4,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'ranged',
    family: 'flame_fox',
    statsInput: {
      maxHp: 320,
      attack: 31,
      attackSpeed: 6,
      attackRangeRanks: 5,
      criticalRate: 0.12,
      criticalDamage: 2.1,
      armor: 18,
      evasionRate: 35,
      resistances: { fire: 10 },
      elemental: { element: 'fire', power: 10 },
    },
    rewards: {
      techniqueInsight: 35,
      spiritStone: 8,
    },
  }),

  defineEnemy({
    id: 'ferocious_magma_boar',
    name: 'Hung Nham Trư',
    level: 4,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'magma_boar',
    statsInput: {
      maxHp: 515,
      attack: 43,
      attackSpeed: 4,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 1.9,
      armor: 23,
      evasionRate: 10,
      resistances: { fire: 15, earth: 10 },
      elemental: { element: 'fire', power: 12 },
    },
    rewards: {
      techniqueInsight: 65,
      spiritStone: 16,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 325,
      spiritStone: 96,
    },
    bossRewards: {
      techniqueInsight: 815,
      spiritStone: 240,
      itemDrops: [{ kind: 'equipment', itemId: 'base_quan', chance: 0.4 }],
    },
  }),

  // --- Tầng 5 (Thổ, Hoàng Sa Nguyên) ---
  defineEnemy({
    id: 'sand_lynx',
    name: 'Sa Miêu',
    level: 5,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'sand_lynx',
    statsInput: {
      maxHp: 375,
      attack: 36,
      attackSpeed: 6,
      attackRangeRanks: 1,
      criticalRate: 0.15,
      criticalDamage: 2.2,
      armor: 20,
      evasionRate: 35,
      resistances: { earth: 10 },
      elemental: { element: 'earth', power: 11 },
    },
    rewards: {
      techniqueInsight: 40,
      spiritStone: 10,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.35 }],
    },
  }),

  defineEnemy({
    id: 'rock_bear',
    name: 'Nham Hùng',
    level: 5,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'rock_bear',
    statsInput: {
      maxHp: 600,
      attack: 50,
      attackSpeed: 3,
      attackRangeRanks: 1,
      criticalRate: 0.02,
      criticalDamage: 1.6,
      armor: 26,
      evasionRate: 6,
      resistances: { earth: 20 },
      elemental: { element: 'earth', power: 10 },
    },
    rewards: {
      techniqueInsight: 75,
      spiritStone: 18,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 375,
      spiritStone: 108,
    },
    bossRewards: {
      techniqueInsight: 940,
      spiritStone: 270,
      itemDrops: [{ kind: 'equipment', itemId: 'base_hai', chance: 0.4 }],
    },
  }),

  // --- Tầng 6 (Thổ, Hoàng Nhạc Sơn) ---
  defineEnemy({
    id: 'ferocious_sand_lynx',
    name: 'Hung Sa Miêu',
    level: 6,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'sand_lynx',
    statsInput: {
      maxHp: 440,
      attack: 41,
      attackSpeed: 6,
      attackRangeRanks: 1,
      criticalRate: 0.17,
      criticalDamage: 2.3,
      armor: 22,
      evasionRate: 35,
      resistances: { earth: 10 },
      elemental: { element: 'earth', power: 11 },
    },
    rewards: {
      techniqueInsight: 45,
      spiritStone: 11,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.35 }],
    },
  }),

  defineEnemy({
    id: 'ferocious_rock_bear',
    name: 'Hung Nham Hùng',
    level: 6,
    realmId: 'qi_refining',
    lane: 'ground',
    family: 'rock_bear',
    statsInput: {
      maxHp: 705,
      attack: 57,
      attackSpeed: 3,
      attackRangeRanks: 1,
      criticalRate: 0.03,
      criticalDamage: 1.7,
      armor: 29,
      evasionRate: 6,
      resistances: { earth: 20 },
      elemental: { element: 'earth', power: 10 },
    },
    rewards: {
      techniqueInsight: 85,
      spiritStone: 20,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 425,
      spiritStone: 120,
    },
    bossRewards: {
      techniqueInsight: 1065,
      spiritStone: 300,
      itemDrops: [{ kind: 'equipment', itemId: 'base_hai', chance: 0.4 }],
    },
  }),

  // --- Tầng 7 (Kim, Bạch Nhận Sơn) ---
  defineEnemy({
    id: 'blade_hawk',
    name: 'Đoạn Nhận Ưng',
    level: 7,
    realmId: 'qi_refining',
    lane: 'air',
    archetype: 'ranged',
    family: 'blade_hawk',
    statsInput: {
      maxHp: 515,
      attack: 47,
      attackSpeed: 7,
      attackRangeRanks: 5,
      criticalRate: 0.14,
      criticalDamage: 2.2,
      armor: 24,
      evasionRate: 50,
      resistances: { metal: 12 },
      elemental: { element: 'metal', power: 12 },
    },
    rewards: {
      techniqueInsight: 50,
      spiritStone: 12,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
  }),

  defineEnemy({
    id: 'metal_beetle',
    name: 'Kim Giáp Trùng',
    level: 7,
    realmId: 'qi_refining',
    lane: 'underground',
    archetype: 'caster',
    family: 'metal_beetle',
    statsInput: {
      maxHp: 825,
      attack: 66,
      attackSpeed: 3,
      attackRangeRanks: 5,
      criticalRate: 0.03,
      criticalDamage: 1.6,
      armor: 31,
      evasionRate: 8,
      resistances: { metal: 25 },
      elemental: { element: 'metal', power: 13 },
    },
    rewards: {
      techniqueInsight: 95,
      spiritStone: 23,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 475,
      spiritStone: 138,
    },
    bossRewards: {
      techniqueInsight: 1190,
      spiritStone: 345,
      itemDrops: [{ kind: 'equipment', itemId: 'base_gioi', chance: 0.4 }],
    },
  }),

  // --- Tầng 8 (Kim, Bạch Nhận Quật) ---
  defineEnemy({
    id: 'ferocious_blade_hawk',
    name: 'Hung Đoạn Nhận Ưng',
    level: 8,
    realmId: 'qi_refining',
    lane: 'air',
    archetype: 'ranged',
    family: 'blade_hawk',
    statsInput: {
      maxHp: 600,
      attack: 55,
      attackSpeed: 7,
      attackRangeRanks: 5,
      criticalRate: 0.16,
      criticalDamage: 2.3,
      armor: 26,
      evasionRate: 50,
      resistances: { metal: 12 },
      elemental: { element: 'metal', power: 12 },
    },
    rewards: {
      techniqueInsight: 55,
      spiritStone: 14,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
  }),

  defineEnemy({
    id: 'ferocious_metal_beetle',
    name: 'Hung Kim Giáp Trùng',
    level: 8,
    realmId: 'qi_refining',
    lane: 'underground',
    archetype: 'caster',
    family: 'metal_beetle',
    statsInput: {
      maxHp: 960,
      attack: 77,
      attackSpeed: 3,
      attackRangeRanks: 5,
      criticalRate: 0.04,
      criticalDamage: 1.7,
      armor: 34,
      evasionRate: 8,
      resistances: { metal: 25 },
      elemental: { element: 'metal', power: 13 },
    },
    rewards: {
      techniqueInsight: 110,
      spiritStone: 27,
      itemDrops: [{ kind: 'material', itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }],
    },
    eliteRewards: {
      techniqueInsight: 550,
      spiritStone: 162,
    },
    bossRewards: {
      techniqueInsight: 1375,
      spiritStone: 405,
      itemDrops: [{ kind: 'equipment', itemId: 'base_gioi', chance: 0.4 }],
    },
  }),

  // --- Tầng 9 (Thủy, Huyền Đàm Trạch) ---
  defineEnemy({
    id: 'pool_toad',
    name: 'Đàm Oa',
    level: 9,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'caster',
    family: 'pool_toad',
    statsInput: {
      maxHp: 700,
      attack: 63,
      attackSpeed: 4,
      attackRangeRanks: 5,
      criticalRate: 0.08,
      criticalDamage: 1.9,
      armor: 28,
      evasionRate: 20,
      resistances: { water: 12 },
      elemental: { element: 'water', power: 12 },
    },
    rewards: {
      techniqueInsight: 65,
      spiritStone: 16,
    },
  }),

  defineEnemy({
    id: 'flood_serpent',
    name: 'Giao Xà',
    level: 9,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'caster',
    family: 'flood_serpent',
    statsInput: {
      maxHp: 1125,
      attack: 88,
      attackSpeed: 4,
      attackRangeRanks: 5,
      criticalRate: 0.06,
      criticalDamage: 2,
      armor: 36,
      evasionRate: 15,
      resistances: { water: 20 },
      elemental: { element: 'water', power: 14 },
    },
    rewards: {
      techniqueInsight: 125,
      spiritStone: 31,
    },
    eliteRewards: {
      techniqueInsight: 625,
      spiritStone: 186,
    },
    bossRewards: {
      techniqueInsight: 1565,
      spiritStone: 465,
      itemDrops: [{ kind: 'equipment', itemId: 'base_truy', chance: 0.4 }],
    },
  }),

  // --- Tầng 10 (Thủy, Huyền Đàm Uyên — chặng cuối trước Trúc Cơ) ---
  defineEnemy({
    id: 'ferocious_pool_toad',
    name: 'Hung Đàm Oa',
    level: 10,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'caster',
    family: 'pool_toad',
    statsInput: {
      maxHp: 825,
      attack: 73,
      attackSpeed: 4,
      attackRangeRanks: 5,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 30,
      evasionRate: 20,
      resistances: { water: 12 },
      elemental: { element: 'water', power: 12 },
    },
    rewards: {
      techniqueInsight: 75,
      spiritStone: 18,
    },
  }),

  defineEnemy({
    id: 'ferocious_flood_serpent',
    name: 'Hung Giao Xà',
    level: 10,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'caster',
    family: 'flood_serpent',
    // Phase A2 (2026-09-07) — turn-based enrage trigger; buff resolves
    // through TURN_BUFF_REGISTRY at spawn (see TurnBattleAdapter).
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'qi_refining_serpent_enrage' },
    // Phase A3 Task 5 — periodic heavy attack (every 4th own action),
    // multiplier proportional to realm tier; playtesting starting points.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' }],
    statsInput: {
      maxHp: 1320,
      attack: 102,
      attackSpeed: 4,
      attackRangeRanks: 5,
      criticalRate: 0.08,
      criticalDamage: 2.2,
      armor: 39,
      evasionRate: 15,
      resistances: { water: 20 },
      elemental: { element: 'water', power: 14 },
    },
    rewards: {
      techniqueInsight: 145,
      spiritStone: 35,
    },
    eliteRewards: {
      techniqueInsight: 725,
      spiritStone: 210,
    },
    bossRewards: {
      techniqueInsight: 1815,
      spiritStone: 525,
      itemDrops: [
        { kind: 'equipment', itemId: 'base_truy', chance: 0.4 },
        // Spec dot-pha-loi-kiep §4.1b — Yêu Đan 100% từ boss LK t10,
        // nguyên liệu chính Thông Mạch Đan/Trúc Cơ Đan.
        { kind: 'material', itemId: 'yeu_dan_hung_giao', amount: 1, chance: 1 },
      ],
    },
  }),

  // Phàm Nhân Động 1-10 (2026-08-16) — cùng "quy luật" Ngũ Hành Tương
  // Sinh/2-loài-mỗi-hành/"Hung "-đổi-tầng-chẵn đã dùng cho Luyện Khí
  // (xem memory content-pass), nhưng CÔNG THỨC RIÊNG, base THẤP HƠN hẳn
  // (mortal tier, dưới Luyện Khí) — T reset về 1 trong phạm vi Phàm
  // Nhân, KHÔNG dùng chung 1 đường cong xuyên cảnh giới với Luyện Khí:
  // beastHP(T) = round(60 * 1.17^(T-1)), beastATK(T) = round(6 * 1.155^(T-1)),
  // armor = 5 + T. Loài boss-eligible (2nd loài mỗi hành, luôn là
  // bossEnemyId của Stage) = beast × 1.6 HP / × 1.4 ATK / × 1.3 armor,
  // CÙNG T — vẫn PRE-multiplier (applyBossMultiplier tự nhân thêm ×7/×1.6
  // lúc spawn boss thật, không tự cộng dồn ở đây). Không có material
  // riêng mới (tránh material chết không ai tiêu) — chỉ rơi
  // green-spirit-herb đã có sẵn.
  defineEnemy({
    id: 'mortal_wild_boar',
    name: 'Dã Trư',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    family: 'boar',
    statsInput: {
      maxHp: 60,
      attack: 6,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 6,
      resistances: { wood: 5 },
      elemental: { element: 'wood', power: 2 },
    },
    rewards: {
      techniqueInsight: 5,
      spiritStone: 1,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 1, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_mountain_bandit',
    name: 'Sơn Khấu',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    family: 'bandit',
    statsInput: {
      maxHp: 96,
      attack: 8,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 8,
      evasionRate: 15,
      resistances: { wood: 8 },
      elemental: { element: 'wood', power: 3 },
    },
    rewards: {
      techniqueInsight: 10,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 1, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 130,
      spiritStone: 26,
      // Guaranteed weapon drop (PLAN HOÀN CHỈNH mục 1) — boss Động 1,
      // quái đầu tiên người chơi gặp, KHÔNG có nguồn vũ khí nào khác ở
      // Phàm Nhân trước bản sửa này (toàn bộ realm chỉ rơi material).
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 3, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 1 },
      ],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_wild_boar',
    name: 'Hung Dã Trư',
    level: 2,
    realmId: 'mortal',
    lane: 'ground',
    family: 'boar',
    statsInput: {
      maxHp: 70,
      attack: 7,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 7,
      resistances: { wood: 5 },
      elemental: { element: 'wood', power: 3 },
    },
    rewards: {
      techniqueInsight: 6,
      spiritStone: 1,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 2, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_mountain_bandit',
    name: 'Hung Sơn Khấu',
    level: 2,
    realmId: 'mortal',
    lane: 'ground',
    family: 'bandit',
    statsInput: {
      maxHp: 112,
      attack: 10,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 9,
      evasionRate: 15,
      resistances: { wood: 8 },
      elemental: { element: 'wood', power: 4 },
    },
    rewards: {
      techniqueInsight: 12,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 2, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 156,
      spiritStone: 26,
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 6, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.5 },
      ],
    },
  }),

  defineEnemy({
    id: 'mortal_feral_dog',
    name: 'Hoang Cẩu',
    level: 3,
    realmId: 'mortal',
    lane: 'ground',
    family: 'dog',
    statsInput: {
      maxHp: 82,
      attack: 8,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 8,
      resistances: { fire: 5 },
      elemental: { element: 'fire', power: 3 },
    },
    rewards: {
      techniqueInsight: 7,
      spiritStone: 1,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 3, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_savage_tiger',
    name: 'Man Hổ',
    level: 3,
    realmId: 'mortal',
    lane: 'ground',
    family: 'tiger',
    statsInput: {
      maxHp: 131,
      attack: 11,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 10,
      evasionRate: 15,
      resistances: { fire: 8 },
      elemental: { element: 'fire', power: 4 },
    },
    rewards: {
      techniqueInsight: 14,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 3, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 182,
      spiritStone: 26,
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 9, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.4 },
      ],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_feral_dog',
    name: 'Hung Hoang Cẩu',
    level: 4,
    realmId: 'mortal',
    lane: 'ground',
    family: 'dog',
    statsInput: {
      maxHp: 96,
      attack: 9,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 9,
      resistances: { fire: 5 },
      elemental: { element: 'fire', power: 4 },
    },
    rewards: {
      techniqueInsight: 8,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 4, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_savage_tiger',
    name: 'Hung Man Hổ',
    level: 4,
    realmId: 'mortal',
    lane: 'ground',
    family: 'tiger',
    statsInput: {
      maxHp: 154,
      attack: 13,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 12,
      evasionRate: 15,
      resistances: { fire: 8 },
      elemental: { element: 'fire', power: 5 },
    },
    rewards: {
      techniqueInsight: 16,
      spiritStone: 4,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 4, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 208,
      spiritStone: 52,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 12, chance: 1 }],
    },
  }),

  defineEnemy({
    id: 'mortal_stone_lynx',
    name: 'Thạch Miêu',
    level: 5,
    realmId: 'mortal',
    lane: 'ground',
    family: 'lynx',
    statsInput: {
      maxHp: 112,
      attack: 11,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 10,
      resistances: { earth: 5 },
      elemental: { element: 'earth', power: 4 },
    },
    rewards: {
      techniqueInsight: 9,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 5, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_mud_ox',
    name: 'Nê Ngưu',
    level: 5,
    realmId: 'mortal',
    lane: 'ground',
    family: 'ox',
    statsInput: {
      maxHp: 179,
      attack: 15,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 13,
      evasionRate: 15,
      resistances: { earth: 8 },
      elemental: { element: 'earth', power: 6 },
    },
    rewards: {
      techniqueInsight: 18,
      spiritStone: 4,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 5, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 234,
      spiritStone: 52,
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 15, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.4 },
      ],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_stone_lynx',
    name: 'Hung Thạch Miêu',
    level: 6,
    realmId: 'mortal',
    lane: 'ground',
    family: 'lynx',
    statsInput: {
      maxHp: 132,
      attack: 12,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 11,
      resistances: { earth: 5 },
      elemental: { element: 'earth', power: 5 },
    },
    rewards: {
      techniqueInsight: 10,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 6, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_mud_ox',
    name: 'Hung Nê Ngưu',
    level: 6,
    realmId: 'mortal',
    lane: 'ground',
    family: 'ox',
    statsInput: {
      maxHp: 211,
      attack: 17,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 14,
      evasionRate: 15,
      resistances: { earth: 8 },
      elemental: { element: 'earth', power: 7 },
    },
    rewards: {
      techniqueInsight: 20,
      spiritStone: 4,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 6, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 260,
      spiritStone: 52,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 18, chance: 1 }],
    },
  }),

  defineEnemy({
    id: 'mortal_silver_fox',
    name: 'Ngân Hồ',
    level: 7,
    realmId: 'mortal',
    lane: 'ground',
    family: 'fox',
    statsInput: {
      maxHp: 154,
      attack: 14,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 12,
      resistances: { metal: 5 },
      elemental: { element: 'metal', power: 6 },
    },
    rewards: {
      techniqueInsight: 12,
      spiritStone: 2,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 7, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_iron_boar',
    name: 'Thiết Giáp Trư',
    level: 7,
    realmId: 'mortal',
    lane: 'ground',
    family: 'boar',
    statsInput: {
      maxHp: 246,
      attack: 20,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 16,
      evasionRate: 15,
      resistances: { metal: 8 },
      elemental: { element: 'metal', power: 8 },
    },
    rewards: {
      techniqueInsight: 24,
      spiritStone: 4,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 7, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 312,
      spiritStone: 52,
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 21, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.4 },
      ],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_silver_fox',
    name: 'Hung Ngân Hồ',
    level: 8,
    realmId: 'mortal',
    lane: 'ground',
    family: 'fox',
    statsInput: {
      maxHp: 180,
      attack: 16,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 13,
      resistances: { metal: 5 },
      elemental: { element: 'metal', power: 6 },
    },
    rewards: {
      techniqueInsight: 13,
      spiritStone: 3,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 8, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_iron_boar',
    name: 'Hung Thiết Giáp Trư',
    level: 8,
    realmId: 'mortal',
    lane: 'ground',
    family: 'boar',
    statsInput: {
      maxHp: 288,
      attack: 22,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 17,
      evasionRate: 15,
      resistances: { metal: 8 },
      elemental: { element: 'metal', power: 9 },
    },
    rewards: {
      techniqueInsight: 26,
      spiritStone: 6,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 8, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 338,
      spiritStone: 78,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 24, chance: 1 }],
    },
  }),

  defineEnemy({
    id: 'mortal_water_wolf',
    name: 'Thủy Lang',
    level: 9,
    realmId: 'mortal',
    lane: 'ground',
    family: 'wolf',
    statsInput: {
      maxHp: 211,
      attack: 19,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 14,
      resistances: { water: 5 },
      elemental: { element: 'water', power: 8 },
    },
    rewards: {
      techniqueInsight: 15,
      spiritStone: 3,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 9, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_giant_crocodile',
    name: 'Cự Ngạc',
    level: 9,
    realmId: 'mortal',
    lane: 'ground',
    family: 'crocodile',
    statsInput: {
      maxHp: 338,
      attack: 27,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 18,
      evasionRate: 15,
      resistances: { water: 8 },
      elemental: { element: 'water', power: 11 },
    },
    rewards: {
      techniqueInsight: 30,
      spiritStone: 6,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 9, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 390,
      spiritStone: 78,
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 27, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.4 },
      ],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_water_wolf',
    name: 'Hung Thủy Lang',
    level: 10,
    realmId: 'mortal',
    lane: 'ground',
    family: 'wolf',
    statsInput: {
      maxHp: 247,
      attack: 22,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 15,
      resistances: { water: 5 },
      elemental: { element: 'water', power: 9 },
    },
    rewards: {
      techniqueInsight: 18,
      spiritStone: 4,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 10, chance: 0.7 }],
    },
  }),

  defineEnemy({
    id: 'mortal_ferocious_giant_crocodile',
    name: 'Hung Cự Ngạc',
    level: 10,
    realmId: 'mortal',
    lane: 'ground',
    family: 'crocodile',
    // Phase A2 (2026-09-07) — turn-based enrage trigger; buff resolves
    // through TURN_BUFF_REGISTRY at spawn (see TurnBattleAdapter).
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'mortal_crocodile_enrage' },
    // Phase A3 Task 5 — periodic heavy attack (every 4th own action),
    // multiplier proportional to realm tier; playtesting starting points.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2, presetId: 'water_surge' }],
    statsInput: {
      maxHp: 395,
      attack: 31,
      attackSpeed: 5,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2,
      armor: 20,
      evasionRate: 15,
      resistances: { water: 8 },
      elemental: { element: 'water', power: 12 },
    },
    rewards: {
      techniqueInsight: 36,
      spiritStone: 8,
      itemDrops: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 10, chance: 0.7 }],
    },
    bossRewards: {
      techniqueInsight: 468,
      spiritStone: 104,
      itemDrops: [
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 30, chance: 1 },
        { kind: 'equipment', itemId: 'base_kiem', chance: 0.5 },
      ],
    },
  }),
]

// ============================================================
// Trúc Cơ content pass M1 (2026-08-29) — 20 quái cho chương 3
// (stage `foundation_floor_1..10`, xem data/stage/Stages.ts), đúng
// "quy luật" Ngũ Hành Tương Sinh Mộc(1-2)->Hỏa(3-4)->Thổ(5-6)->
// Kim(7-8)->Thủy(9-10) và cấu trúc 2 loài/tầng (1 thường + 1
// boss-eligible, tầng chẵn tiền tố "Hung ") của Luyện Khí + Phàm Nhân,
// nhưng CÔNG THỨC RIÊNG (first pass, playtest chỉnh):
//   beastHP(T)   = round(450 * 1.2^(T-1))
//   beastATK(T)  = round(42  * 1.15^(T-1))
//   armor        = 18 + 2T
// Loài boss-eligible (2nd loài mỗi hành, luôn là bossEnemyId của
// Stage) = ×1.6 HP / ×1.4 ATK / ×1.3 armor, CÙNG T — vẫn
// PRE-multiplier (applyBossMultiplier tự nhân thêm ×7/×1.6 lúc spawn
// boss thật, không tự cộng dồn ở đây). attackSpeed author theo thang
// mới (0.8-2.5 đòn/giây, xem EnemyStatInput.normalizeEnemyAttackSpeed).
// Không material mới (tránh material chết không ai tiêu) — chỉ rơi
// Thập Niên Linh Khoáng (qi_refining_ore_decade, sink thật qua
// Cường Hóa/Tẩy Luyện + quest collect).
// ============================================================

// Boss tầng 10 (`foundation_floor_10`, Màn 3.10) — 2 phase theo mốc HP
// + enrage DPS check, đúng spec M1 mục 4.1 ("boss Trúc Cơ đầu tiên
// dùng cơ chế phase/enrage làm hình mẫu"). Primitive tái dùng chung
// với quái Kiếp (xem core/enemy/TribulationPhase.ts — BattleSystem
// updateTribulationPhases/updateEnrage generic cho mọi Enemy khai field).
const FLOOD_DRAGON_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.5,
    buff: {
      id: 'foundation_dragon_phase1',
      name: 'Giao Sủng Cuồng Nộ',
      description: 'Giao Sủng bộc phát sát khí khi mất nửa máu.',
      polarity: 'buff' as const,
      duration: Infinity,
      stackMode: 'replace' as const,
      effects: [
        { type: 'statModifier' as const, stat: 'attack' as const, percent: 0.3 },
        { type: 'statModifier' as const, stat: 'speed' as const, percent: 0.1 },
      ],
    },
    message: 'Giao Sủng cuồng nộ — lôi kích bùng nổ!',
  },
  {
    hpThresholdPercent: 0.25,
    buff: {
      id: 'foundation_dragon_phase2',
      name: 'Giao Sủng Tuyệt Mệnh',
      description: 'Giao Sủng liều mạng tăng sát thương.',
      polarity: 'buff' as const,
      duration: Infinity,
      stackMode: 'replace' as const,
      effects: [
        { type: 'statModifier' as const, stat: 'attack' as const, percent: 0.25 },
        { type: 'statModifier' as const, stat: 'criticalRate' as const, percent: 0.15 },
      ],
    },
    message: 'Giao Sủng tuyệt mệnh phản công!',
  },
]

const FLOOD_DRAGON_ENRAGE: BossEnrage = {
  afterSeconds: 60,
  buff: {
    id: 'foundation_dragon_enrage',
    name: 'Đại Vương Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Giao Sủng điên cuồng.',
    polarity: 'buff' as const,
    duration: Infinity,
    stackMode: 'replace' as const,
    effects: [
      { type: 'statModifier' as const, stat: 'attack' as const, percent: 0.5 },
      { type: 'statModifier' as const, stat: 'speed' as const, percent: 0.2 },
    ],
  },
}

function foundationBeast(params: {
  id: string
  name: string
  t: number
  lane: 'ground' | 'air'
  archetype?: 'melee' | 'ranged' | 'caster'
  bossEligible: boolean
  element: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
  power: number
  resistance: number
  tribulationPhases?: TribulationPhase[]
  enrage?: BossEnrage
  // Phase A2 (2026-09-07) — turn-based enrage trigger, threaded through
  // to defineEnemy() unchanged. Separate from the legacy `enrage` above.
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }
  specialAttacks?: EnemySpecialAttack[]
}) {
  const hp = Math.round(450 * 1.2 ** (params.t - 1))
  const atk = Math.round(42 * 1.15 ** (params.t - 1))
  const armor = 18 + 2 * params.t

  const mult = params.bossEligible
    ? { hp: 1.6, atk: 1.4, armor: 1.3, insight: 2.5, stone: 6 }
    : { hp: 1, atk: 1, armor: 1, insight: 1, stone: 1 }

  const insight = 40 + 6 * params.t
  const stone = 8 + 2 * params.t

  return defineEnemy({
    id: params.id,
    name: params.name,
    level: params.t,
    realmId: 'foundation_establishment',
    lane: params.lane,
    archetype: params.archetype,
    tribulationPhases: params.tribulationPhases,
    enrage: params.enrage,
    bossTrigger: params.bossTrigger,
    specialAttacks: params.specialAttacks,
    statsInput: {
      maxHp: Math.round(hp * mult.hp),
      attack: Math.round(atk * mult.atk),
      attackSpeed: 1.6,
      attackRangeRanks: params.archetype === 'melee' ? 1 : 5,
      criticalRate: 0.08,
      criticalDamage: 2,
      armor: Math.round(armor * mult.armor),
      evasionRate: 20,
      resistances: { [params.element]: params.resistance },
      elemental: { element: params.element, power: params.power },
    },
    rewards: {
      techniqueInsight: Math.round(insight * mult.insight),
      spiritStone: Math.round(stone * mult.stone),
      itemDrops: params.bossEligible
        ? [{ kind: 'material' as const, itemId: 'qi_refining_ore_decade', amount: 1, chance: 0.3 }]
        : undefined,
    },
    eliteRewards: params.bossEligible
      ? {
          techniqueInsight: Math.round(insight * 5),
          spiritStone: Math.round(stone * 6),
        }
      : undefined,
    bossRewards: params.bossEligible
      ? {
          techniqueInsight: Math.round(insight * 12.5),
          spiritStone: Math.round(stone * 15),
          itemDrops: [
            { kind: 'equipment' as const, itemId: 'base_kiem', chance: params.t === 10 ? 0.5 : 0.4 },
          ],
        }
      : undefined,
  })
}

const FOUNDATION_ENEMIES: Enemy[] = [
  // --- Tầng 1-2 (Mộc, hậu sơn rừng già) ---
  foundationBeast({
    id: 'foundation_wood_ape',
    name: 'Viêm Giáp Viên',
    t: 1,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'wood',
    power: 10,
    resistance: 10,
  }),
  foundationBeast({
    id: 'foundation_stone_fungus',
    name: 'Địa Tinh Giám',
    t: 1,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: true,
    element: 'wood',
    power: 10,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_ferocious_wood_ape',
    name: 'Hung Viêm Giáp Viên',
    t: 2,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'wood',
    power: 10,
    resistance: 10,
  }),
  foundationBeast({
    id: 'foundation_ferocious_stone_fungus',
    name: 'Hung Địa Tinh Giám',
    t: 2,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: true,
    element: 'wood',
    power: 10,
    resistance: 12,
  }),

  // --- Tầng 3-4 (Hỏa, hỏa địa hậu sơn) ---
  foundationBeast({
    id: 'foundation_lava_hound',
    name: 'Dực Hỏa Khuyển',
    t: 3,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'fire',
    power: 11,
    resistance: 11,
  }),
  foundationBeast({
    id: 'foundation_sand_scorpion',
    name: 'Sa Hắc',
    t: 3,
    lane: 'ground',
    archetype: 'ranged',
    bossEligible: true,
    element: 'fire',
    power: 11,
    resistance: 14,
  }),
  foundationBeast({
    id: 'foundation_ferocious_lava_hound',
    name: 'Hung Dực Hỏa Khuyển',
    t: 4,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'fire',
    power: 11,
    resistance: 11,
  }),
  foundationBeast({
    id: 'foundation_ferocious_sand_scorpion',
    name: 'Hung Sa Hắc',
    t: 4,
    lane: 'ground',
    archetype: 'ranged',
    bossEligible: true,
    element: 'fire',
    power: 11,
    resistance: 14,
  }),

  // --- Tầng 5-6 (Thổ, thạch cốc hậu sơn) ---
  foundationBeast({
    id: 'foundation_rock_tortoise',
    name: 'Thạch Giáp Quy',
    t: 5,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'earth',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_mud_golem',
    name: 'Nê Cự Nhân',
    t: 5,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'earth',
    power: 12,
    resistance: 16,
  }),
  foundationBeast({
    id: 'foundation_ferocious_rock_tortoise',
    name: 'Hung Thạch Giáp Quy',
    t: 6,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'earth',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_ferocious_mud_golem',
    name: 'Hung Nê Cự Nhân',
    t: 6,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'earth',
    power: 12,
    resistance: 16,
  }),

  // --- Tầng 7-8 (Kim, thiết mãng lệnh) ---
  foundationBeast({
    id: 'foundation_metal_beetle_swarm',
    name: 'Kim Giáp Trùng Quần',
    t: 7,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'metal',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_blade_hawk_king',
    name: 'Đoạn Nhận Ưng Vương',
    t: 7,
    lane: 'air',
    archetype: 'ranged',
    bossEligible: true,
    element: 'metal',
    power: 12,
    resistance: 16,
  }),
  foundationBeast({
    id: 'foundation_ferocious_metal_beetle_swarm',
    name: 'Hung Kim Giáp Trùng Quần',
    t: 8,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'metal',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_ferocious_blade_hawk_king',
    name: 'Hung Đoạn Nhận Ưng Vương',
    t: 8,
    lane: 'air',
    archetype: 'ranged',
    bossEligible: true,
    element: 'metal',
    power: 12,
    resistance: 16,
  }),

  // --- Tầng 9-10 (Thủy, hàn thạch đàm — chặng cuối Trúc Cơ) ---
  foundationBeast({
    id: 'foundation_mist_shark',
    name: 'Vụ Cáp',
    t: 9,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'water',
    power: 14,
    resistance: 14,
  }),
  foundationBeast({
    id: 'foundation_flood_dragon_whelp',
    name: 'Giao Sủng',
    t: 9,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'water',
    power: 14,
    resistance: 20,
  }),
  foundationBeast({
    id: 'foundation_ferocious_mist_shark',
    name: 'Hung Vụ Cáp',
    t: 10,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'water',
    power: 14,
    resistance: 14,
  }),
  foundationBeast({
    id: 'foundation_ferocious_flood_dragon_whelp',
    name: 'Hung Giao Sủng',
    t: 10,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'water',
    power: 14,
    resistance: 20,
    tribulationPhases: FLOOD_DRAGON_PHASES,
    enrage: FLOOD_DRAGON_ENRAGE,
    // Phase A2 (2026-09-07) — turn-based twin of the legacy `enrage`
    // above (same 60-turn magnitude); kept alongside until roadmap C1
    // removes the legacy engine. Buff resolves via TURN_BUFF_REGISTRY.
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'foundation_dragon_enrage' },
    // Combat Balance Pass (2026-08-29, plan §3.6) — boss mẫu có action
    // đặc biệt data-driven: mỗi đòn thứ 4 là "Nuốt Sóng" — đòn nước nặng
    // (×2.5 damage) với preset riêng, windup caster chuẩn. Số minh hoạ,
    // playtest chỉnh. Boss KHÁC chưa khai — tiếp tục basic attack cứng.
    // Phase A3 Task 5 — turn engine now READS this field (see
    // TurnBattleSystem's specialAttackCounter), so this existing example
    // is live in turn-based combat as of A3.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' }],
  }),
]

// Quái ẩn (spec dot-pha-loi-kiep §4.1c) — Huyết Mông KHÔNG thuộc
// enemyPool stage nào; chỉ trà trộn pool spawn qua HiddenBeastSystem
// khi cửa sổ 1000 kill mở (xem core/game/HiddenBeastSystem.ts).
// Rơi Thiên Địa Chi Kiều 5% — nguyên liệu Kỳ Kinh (đường 9 Bát Mạch).
const HIDDEN_BEASTS: Enemy[] = [
  defineEnemy({
    id: 'huyet_mong',
    name: 'Huyết Mông',
    level: 10,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'melee',
    family: 'hidden_beast',
    statsInput: {
      maxHp: 2600,
      attack: 130,
      attackSpeed: 4,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2.2,
      armor: 45,
      evasionRate: 10,
      resistances: { water: 10, fire: 10 },
      elemental: { element: 'water', power: 18 },
    },
    rewards: {
      techniqueInsight: 500,
      spiritStone: 150,
      itemDrops: [
        { kind: 'material', itemId: 'thien_dia_chi_kieu', amount: 1, chance: 0.05 },
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 12, chance: 1 },
      ],
    },
  }),
]

/** Runtime enemy data: linh thảo chỉ đến từ Động Thiên, không rơi từ quái. */
export const ENEMIES: Enemy[] = [...ENEMY_DEFINITIONS, ...FOUNDATION_ENEMIES, ...HIDDEN_BEASTS]
