import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'


// defineEnemy() nhan statsInput gon (~10-13 field, xem EnemyStatInput.ts)
// thay vi phai khai du 41 field Stats nhu truoc - dung khuyen nghi
// Last Epoch, quai thuong khong can bo stat day du nhu player.
export const MORTAL_ENEMIES: Enemy[] = [
  defineEnemy({
    id: 'wild_wolf',

    name: 'Dã Lang',

    level: 1,

    realmId: 'qi_refining',

    lane: 'ground',

    // "tunghematandsuch" pass (2026-08-14) - family chi con y nghia
    // LABEL (nhom hinh anh/lore), khong con quyet dinh material rieng.
    family: 'wolf',

    statsInput: {
      maxHp: 200,
      might: 20,
      attackSpeed: 1.1,
      criticalRate: 0.05,
      criticalDamage: 2,
      armor: 10,

      // Manh thu hoang da, thien Moc/Tho - co chut khang 2 hanh do.
      resistances: { wood: 5, earth: 5 },
      elemental: { element: 'wood', power: 8 },
    },

    rewards: {
      techniqueMastery: 20,
      spiritStone: 5,
    },

    signatureDrops: [
      // Dot Pha Truc Co lore drop - low chance on purpose, carries no
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

      // Dung binh khi kim loai - co chut khang Kim nho giap tru.
      resistances: { metal: 8 },
      elemental: { element: 'metal', power: 10 },
    },

    rewards: {
      techniqueMastery: 40,
      spiritStone: 10,

    },

    // Ban Elite ("Son Tac Dau Linh", xem Stages.ts's eliteChance) -
    // thuong dam hon han + co hoi roi Pha Canh Tam Phap.
    // Core Loop Foundation checklist (Muc BOSS) - boss tier RIENG:
    // GUARANTEED Pha Canh Tam Phap vi Boss KHONG spawn ngau nhien. Gio
    // dien dat qua signatureDrops; drop thuong den tu bang stage/family.
    signatureDrops: [
      // van_kiem_quyet was removed from this table in the Kiem Tu
      // Reimagined teardown (spec 2026-09-15 sec.7): it is the Ngu Kiem
      // Dao signature technique now - granted by the ngu way ritual
      // kit, never lootable.
      // 2026-09-23: great_dao_seed drop retired with the material
      // itself (hidden-perfection-lineage sec.19) - Dai Dao now belongs
      // to the lineage channel, never to loot.
    ],
  }),

  defineEnemy({
    id: 'mountain_hawk',

    name: 'Ó Núi',

    level: 2,

    realmId: 'qi_refining',

    lane: 'air',

    family: 'hawk',

    // Core Loop Foundation checklist (Muc MONSTER) - O Nui bay luon
    // tren cao, giu khoang cach thay vi lao vao can chien.
    archetype: 'ranged',

    statsInput: {
      maxHp: 150,
      might: 25,
      attackSpeed: 1.2,
      criticalRate: 0.12,
      criticalDamage: 2,
      armor: 8,
      // Bay luon, kho trung hon quai mat dat thuong.
      evasionRate: 45,

      // Mong vuot sac - thien Kim.
      resistances: { metal: 10 },
      elemental: { element: 'metal', power: 9 },
    },

    rewards: {
      techniqueMastery: 30,
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

    // Core Loop Foundation checklist (Muc MONSTER) - lan xuong dat
    // roi troi len tan cong, co "khoang lang" telegraph truoc don.
    archetype: 'caster',

    statsInput: {
      maxHp: 450,
      might: 30,
      attackSpeed: 1.0,
      criticalRate: 0.02,
      criticalDamage: 1.5,
      armor: 25,
      // Tank cham, gan nhu khong ne duoc.
      evasionRate: 8,

      // Da day, thien Tho dam.
      resistances: { earth: 15 },
      elemental: { element: 'earth', power: 9 },
    },

    rewards: {
      techniqueMastery: 35,
      spiritStone: 8,
    },

    signatureDrops: [
      // Dot Pha Truc Co lore drop - low chance on purpose.
      { kind: 'material', itemId: 'stele_fragment', amount: { min: 1, max: 1 }, chance: 0.07 },
    ],
  }),

  // Luyen Khi tang 1-10 content pass (2026-08-14) - 18 quai MOI, dung
  // 2 species/tang (1 "beast" thuong + 1 "boss-eligible" tai dung lam
  // bossEnemyId cua stage, y het pattern wild_wolf/bandit hien co).
  // Ngu Hanh Tuong Sinh: Moc(t1-2)->Hoa(t3-4)->Tho(t5-6)->Kim(t7-8)->
  // Thuy(t9-10). Tang chan = species y het tang le trong CUNG cap,
  // chi + tien to "Hung " (hung du hon) + stat manh hon theo cong thuc (xem
  // data/stage/Stages.ts's comment dau file cho cong thuc day du) -
  // KHONG tu them tu chi dang cap (Vuong/Chua/Dau Linh) vao ten, engine
  // da tu them "Tinh Anh "/"Dai Vuong " luc spawn (xem tag tinh_anh qua
  // applyEnemyTags / createBossVariant o core/enemy).

  // --- Tang 2 (Moc, Thanh Van Lam) ---
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
      techniqueMastery: 25,
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
      techniqueMastery: 50,
      spiritStone: 12,
    },
  }),

  // --- Tang 3 (Hoa, Xich Diem Coc) ---
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
      techniqueMastery: 30,
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
      techniqueMastery: 55,
      spiritStone: 14,
    },
  }),

  // --- Tang 4 (Hoa, Xich Diem Linh) ---
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
      techniqueMastery: 35,
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
      techniqueMastery: 65,
      spiritStone: 16,
    },
  }),

  // --- Tang 5 (Tho, Hoang Sa Nguyen) ---
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
      techniqueMastery: 40,
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
      techniqueMastery: 75,
      spiritStone: 18,
    },
  }),

  // --- Tang 6 (Tho, Hoang Nhac Son) ---
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
      techniqueMastery: 45,
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
      techniqueMastery: 85,
      spiritStone: 20,
    },
  }),

  // --- Tang 7 (Kim, Bach Nhan Son) ---
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
      techniqueMastery: 50,
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
      techniqueMastery: 95,
      spiritStone: 23,
    },
  }),

  // --- Tang 8 (Kim, Bach Nhan Quat) ---
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
      techniqueMastery: 55,
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
      techniqueMastery: 110,
      spiritStone: 27,
    },
  }),

  // --- Tang 9 (Thuy, Huyen Dam Trach) ---
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
      techniqueMastery: 65,
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
      techniqueMastery: 125,
      spiritStone: 31,
    },
  }),

  // --- Tang 10 (Thuy, Huyen Dam Uyen - chang cuoi truoc Truc Co) ---
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
      techniqueMastery: 75,
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
    // Phase A2 (2026-09-07) - turn-based enrage trigger; buff resolves
    // through BUFF_REGISTRY at spawn (see TurnBattleAdapter).
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'qi_refining_serpent_enrage' },
    // Phase A3 Task 5 - periodic heavy attack (every 4th own action),
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
      techniqueMastery: 145,
      spiritStone: 35,
    },
    signatureDrops: [
      // Spec dot-pha-loi-kiep sec.4.1b - Yeu Dan 100% tu boss LK t10,
      // nguyen lieu chinh Thong Mach Dan/Truc Co Dan. chance:1 nen boss
      // idle (auto-farm) van roi theo E11.
      { kind: 'material', itemId: 'yeu_dan_hung_giao', amount: { min: 1, max: 1 }, chance: 1, requiresModifier: 'boss' },
    ],
  }),

  // Pham Nhan Dong 1-10 (2026-08-16) - cung "quy luat" Ngu Hanh Tuong
  // Sinh/2-loai-moi-hanh/"Hung "-doi-tang-chan da dung cho Luyen Khi
  // (xem memory content-pass), nhung CONG THUC RIENG, base THAP HON han
  // (mortal tier, duoi Luyen Khi) - T reset ve 1 trong pham vi Pham
  // Nhan, KHONG dung chung 1 duong cong xuyen canh gioi voi Luyen Khi:
  // beastHP(T) = round(60 * 1.17^(T-1)), beastATK(T) = round(6 * 1.155^(T-1)),
  // armor = 5 + T. Loai boss-eligible (2nd loai moi hanh, luon la
  // bossEnemyId cua Stage) = beast x 1.6 HP / x 1.4 ATK / x 1.3 armor,
  // CUNG T - van PRE-multiplier (applyBossMultiplier tu nhan them x7/x1.6
  // luc spawn boss that, khong tu cong don o day). Khong co material
  // rieng moi (tranh material chet khong ai tieu) - chi roi
  // green-spirit-herb da co san.
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
      techniqueMastery: 5,
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
      techniqueMastery: 10,
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
      techniqueMastery: 6,
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
      techniqueMastery: 12,
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
      techniqueMastery: 7,
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
      techniqueMastery: 14,
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
      techniqueMastery: 8,
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
      techniqueMastery: 16,
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
      techniqueMastery: 9,
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
      techniqueMastery: 18,
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
      techniqueMastery: 10,
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
      techniqueMastery: 20,
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
      techniqueMastery: 12,
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
      techniqueMastery: 24,
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
      techniqueMastery: 13,
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
      techniqueMastery: 26,
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
      techniqueMastery: 15,
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
      techniqueMastery: 30,
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
      techniqueMastery: 18,
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
    // Phase A2 (2026-09-07) - turn-based enrage trigger; buff resolves
    // through BUFF_REGISTRY at spawn (see TurnBattleAdapter).
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'mortal_crocodile_enrage' },
    // Phase A3 Task 5 - periodic heavy attack (every 4th own action),
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
      techniqueMastery: 36,
      spiritStone: 8,
    },
  }),
]
