import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'


// defineEnemy() nhận statsInput gọn (~10-13 field, xem EnemyStatInput.ts)
// thay vì phải khai đủ 41 field Stats như trước — đúng khuyến nghị
// Last Epoch, quái thường không cần bộ stat đầy đủ như player.
export const MORTAL_ENEMIES: Enemy[] = [
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
      might: 20,
      attackSpeed: 1.1,
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
    },

    signatureDrops: [
      // Đột Phá Trúc Cơ lore drop - low chance on purpose, carries no
      // functional sink (LORE_ALLOWLIST in EnemyDropSinkInvariant).
      { kind: 'material', itemId: 'cultivator_diary', amount: { min: 1, max: 1 }, chance: 0.07 },
    ],
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
      might: 35,
      attackSpeed: 1.1,
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

    },

    // Bản Elite ("Sơn Tặc Đầu Lĩnh", xem Stages.ts's eliteChance) —
    // thưởng đậm hơn hẳn + cơ hội rơi Phá Cảnh Tâm Pháp.
    // Core Loop Foundation checklist (Mục BOSS) — boss tier RIÊNG:
    // GUARANTEED Phá Cảnh Tâm Pháp vì Boss KHÔNG spawn ngẫu nhiên. Giờ
    // diễn đạt qua signatureDrops; drop thường đến từ bảng stage/family.
    signatureDrops: [
      // van_kiem_quyet was removed from this table in the Kiem Tu
      // Reimagined teardown (spec 2026-09-15 §7): it is the Ngu Kiem
      // Dao signature technique now — granted by the kiem_tu_an node,
      // never lootable.
      // Đột Phá Trúc Cơ (Phase 3) — 0.01%, mức thấp nhất từng có trong
      // codebase, có chủ đích (xem data/materials/materials.ts).
      { kind: 'material', itemId: 'great_dao_seed', amount: { min: 1, max: 1 }, chance: 0.0001, requiresModifier: 'boss' },
    ],
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
      might: 25,
      attackSpeed: 1.2,
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
      might: 30,
      attackSpeed: 1.0,
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
    },

    signatureDrops: [
      // Đột Phá Trúc Cơ lore drop - low chance on purpose.
      { kind: 'material', itemId: 'stele_fragment', amount: { min: 1, max: 1 }, chance: 0.07 },
    ],
  }),

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — 18 quái MỚI, đúng
  // 2 species/tầng (1 "beast" thường + 1 "boss-eligible" tái dùng làm
  // bossEnemyId của stage, y hệt pattern wild_wolf/bandit hiện có).
  // Ngũ Hành Tương Sinh: Mộc(t1-2)→Hỏa(t3-4)→Thổ(t5-6)→Kim(t7-8)→
  // Thủy(t9-10). Tầng chẵn = species y hệt tầng lẻ trong CÙNG cặp,
  // chỉ + tiền tố "Hung " (hung dữ hơn) + stat mạnh hơn theo công thức (xem
  // data/stage/Stages.ts's comment đầu file cho công thức đầy đủ) —
  // KHÔNG tự thêm từ chỉ đẳng cấp (Vương/Chúa/Đầu Lĩnh) vào tên, engine
  // đã tự thêm "Tinh Anh "/"Đại Vương " lúc spawn (xem tag tinh_anh qua
  // applyEnemyTags / createBossVariant ở core/enemy).

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
      might: 23,
      attackSpeed: 1.1,
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
      might: 32,
      attackSpeed: 1.1,
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
      might: 27,
      attackSpeed: 1.15,
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
      might: 38,
      attackSpeed: 1.05,
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
      might: 31,
      attackSpeed: 1.15,
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
      might: 43,
      attackSpeed: 1.05,
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
      might: 36,
      attackSpeed: 1.15,
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
      might: 50,
      attackSpeed: 1.0,
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
      might: 41,
      attackSpeed: 1.15,
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
      might: 57,
      attackSpeed: 1.0,
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
      might: 47,
      attackSpeed: 1.2,
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
      might: 66,
      attackSpeed: 1.0,
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
      might: 55,
      attackSpeed: 1.2,
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
      might: 77,
      attackSpeed: 1.0,
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
      might: 63,
      attackSpeed: 1.05,
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
      might: 88,
      attackSpeed: 1.05,
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
      might: 73,
      attackSpeed: 1.05,
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
    // through BUFF_REGISTRY at spawn (see TurnBattleAdapter).
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'qi_refining_serpent_enrage' },
    // Phase A3 Task 5 — periodic heavy attack (every 4th own action),
    // multiplier proportional to realm tier; playtesting starting points.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' }],
    statsInput: {
      maxHp: 1320,
      might: 102,
      attackSpeed: 1.05,
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
    signatureDrops: [
      // Spec dot-pha-loi-kiep §4.1b — Yêu Đan 100% từ boss LK t10,
      // nguyên liệu chính Thông Mạch Đan/Trúc Cơ Đan. chance:1 nên boss
      // idle (auto-farm) vẫn rơi theo E11.
      { kind: 'material', itemId: 'yeu_dan_hung_giao', amount: { min: 1, max: 1 }, chance: 1, requiresModifier: 'boss' },
      // Companion gacha (Task 6) - chapter-2 floor-10 boss drops 2x
      // Chieu Hien Lenh; boss-only via requiresModifier, chance:1 keeps
      // the idle channel eligible (spec E11).
      { kind: 'material', itemId: 'chieu_hien_lenh', amount: { min: 2, max: 2 }, chance: 1, requiresModifier: 'boss' },
    ],
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
      might: 6,
      attackSpeed: 0.95,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 6,
      resistances: { wood: 5 },
      elemental: { element: 'wood', power: 2 },
    },
    rewards: {
      techniqueInsight: 5,
      spiritStone: 1,
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
      might: 8,
      attackSpeed: 1.0,
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
      might: 7,
      attackSpeed: 0.95,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 7,
      resistances: { wood: 5 },
      elemental: { element: 'wood', power: 3 },
    },
    rewards: {
      techniqueInsight: 6,
      spiritStone: 1,
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
      might: 10,
      attackSpeed: 1.0,
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
      might: 8,
      attackSpeed: 1.0,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 8,
      resistances: { fire: 5 },
      elemental: { element: 'fire', power: 3 },
    },
    rewards: {
      techniqueInsight: 7,
      spiritStone: 1,
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
      might: 11,
      attackSpeed: 1.1,
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
      might: 9,
      attackSpeed: 1.0,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 9,
      resistances: { fire: 5 },
      elemental: { element: 'fire', power: 4 },
    },
    rewards: {
      techniqueInsight: 8,
      spiritStone: 2,
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
      might: 13,
      attackSpeed: 1.1,
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
      might: 11,
      attackSpeed: 1.1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 10,
      resistances: { earth: 5 },
      elemental: { element: 'earth', power: 4 },
    },
    rewards: {
      techniqueInsight: 9,
      spiritStone: 2,
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
      might: 15,
      attackSpeed: 0.9,
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
      might: 12,
      attackSpeed: 1.1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 11,
      resistances: { earth: 5 },
      elemental: { element: 'earth', power: 5 },
    },
    rewards: {
      techniqueInsight: 10,
      spiritStone: 2,
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
      might: 17,
      attackSpeed: 0.9,
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
      might: 14,
      attackSpeed: 1.1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 12,
      resistances: { metal: 5 },
      elemental: { element: 'metal', power: 6 },
    },
    rewards: {
      techniqueInsight: 12,
      spiritStone: 2,
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
      might: 20,
      attackSpeed: 0.95,
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
      might: 16,
      attackSpeed: 1.1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 13,
      resistances: { metal: 5 },
      elemental: { element: 'metal', power: 6 },
    },
    rewards: {
      techniqueInsight: 13,
      spiritStone: 3,
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
      might: 22,
      attackSpeed: 0.95,
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
      might: 19,
      attackSpeed: 1.0,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 14,
      resistances: { water: 5 },
      elemental: { element: 'water', power: 8 },
    },
    rewards: {
      techniqueInsight: 15,
      spiritStone: 3,
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
      might: 27,
      attackSpeed: 0.9,
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
      might: 22,
      attackSpeed: 1.0,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 15,
      resistances: { water: 5 },
      elemental: { element: 'water', power: 9 },
    },
    rewards: {
      techniqueInsight: 18,
      spiritStone: 4,
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
    // through BUFF_REGISTRY at spawn (see TurnBattleAdapter).
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'mortal_crocodile_enrage' },
    // Phase A3 Task 5 — periodic heavy attack (every 4th own action),
    // multiplier proportional to realm tier; playtesting starting points.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2, presetId: 'water_surge' }],
    statsInput: {
      maxHp: 395,
      might: 31,
      attackSpeed: 0.9,
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
    },
    signatureDrops: [
      // Companion gacha (Task 6) - chapter-1 floor-10 boss drops 1x
      // Chieu Hien Lenh; boss-only via requiresModifier.
      { kind: 'material', itemId: 'chieu_hien_lenh', amount: { min: 1, max: 1 }, chance: 1, requiresModifier: 'boss' },
    ],
  }),
]
