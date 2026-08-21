import { defineEnemy, type Enemy } from '@/core/enemy/Enemy'
import type { Buff } from '@/core/buff/Buff'
import type { TribulationPhase } from '@/core/enemy/TribulationPhase'

// Độ Kiếp (mục 11/12 spec `breakthrough`) — 4 quái Kiếp, 1 cho mỗi
// tier Căn Cơ (xem core/breakthrough/FoundationType.ts). KHÔNG đăng ký
// vào enemy registry chung (Enemies.ts/GameManager.registerEnemyTemplates)
// — GameManager.startTribulation() truyền thẳng object Enemy này vào
// startBattleWithPlayer(), giống cách startBattle() nhận trực tiếp 1
// Enemy bất kỳ (xem core/game/GameManager.ts's startBattle()).
//
// tribulationPhases: mỗi tier có mốc HP + buff RIÊNG (mục "Đầy đủ —
// thêm multi-phase/mechanic riêng cho từng tầng Căn Cơ ngay từ đầu"),
// buff KHÔNG có `duration` = tồn tại vĩnh viễn suốt trận (xem
// BuffSystem.update()) — quái càng gần chết càng leo thang sức mạnh,
// đúng "Căn cơ càng cao không phải chỉ là phần thưởng — nó đồng thời
// là thử thách lớn hơn" (mục 12).

function enrageBuff(id: string, name: string, modifiers: Buff['modifiers']): Buff {
  return {
    id,
    name,
    description: `Kiếp lôi bộc phát — ${name}.`,
    category: 'buff',
    stacks: 1,
    stackMode: 'replace',
    modifiers,
  }
}

const HUMAN_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.5,
    buff: enrageBuff('tribulation_human_phase1', 'Nhân Kiếp Bộc Phát', [
      { id: 'tribulation_human_phase1_attack', sourceId: 'tribulation_human_phase1', sourceType: 'buff', stat: 'attack', percent: 0.3 },
    ]),
    message: 'Nhân Đạo Kiếp bộc phát sát khí!',
  },
]

const EARTH_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.6,
    buff: enrageBuff('tribulation_earth_phase1', 'Địa Kiếp Cuồng Nộ I', [
      { id: 'tribulation_earth_phase1_attack', sourceId: 'tribulation_earth_phase1', sourceType: 'buff', stat: 'attack', percent: 0.25 },
    ]),
    message: 'Địa Đạo Kiếp bắt đầu cuồng nộ!',
  },
  {
    hpThresholdPercent: 0.3,
    buff: enrageBuff('tribulation_earth_phase2', 'Địa Kiếp Cuồng Nộ II', [
      { id: 'tribulation_earth_phase2_attack', sourceId: 'tribulation_earth_phase2', sourceType: 'buff', stat: 'attack', percent: 0.25 },
      { id: 'tribulation_earth_phase2_armor', sourceId: 'tribulation_earth_phase2', sourceType: 'buff', stat: 'defense', percent: 0.2 },
    ]),
    message: 'Địa Đạo Kiếp lộ rõ sát ý!',
  },
]

const HEAVEN_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.66,
    buff: enrageBuff('tribulation_heaven_phase1', 'Thiên Kiếp Gia Tốc', [
      { id: 'tribulation_heaven_phase1_speed', sourceId: 'tribulation_heaven_phase1', sourceType: 'buff', stat: 'attackSpeed', percent: 0.15 },
    ]),
    message: 'Thiên Đạo Kiếp gia tốc!',
  },
  {
    hpThresholdPercent: 0.33,
    buff: enrageBuff('tribulation_heaven_phase2', 'Thiên Kiếp Chí Mạng', [
      { id: 'tribulation_heaven_phase2_crit', sourceId: 'tribulation_heaven_phase2', sourceType: 'buff', stat: 'criticalRate', percent: 0.2 },
    ]),
    message: 'Thiên Đạo Kiếp nhắm chí mạng!',
  },
  {
    hpThresholdPercent: 0.15,
    buff: enrageBuff('tribulation_heaven_phase3', 'Thiên Kiếp Tối Hậu', [
      { id: 'tribulation_heaven_phase3_speed', sourceId: 'tribulation_heaven_phase3', sourceType: 'buff', stat: 'attackSpeed', percent: 0.2 },
      { id: 'tribulation_heaven_phase3_critdmg', sourceId: 'tribulation_heaven_phase3', sourceType: 'buff', stat: 'criticalDamage', percent: 0.3 },
    ]),
    message: 'Thiên Đạo Kiếp bùng nổ tối hậu!',
  },
]

const GREAT_DAO_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.7,
    buff: enrageBuff('tribulation_great_dao_phase1', 'Đại Đạo Kiếp Khởi', [
      { id: 'tribulation_great_dao_phase1_attack', sourceId: 'tribulation_great_dao_phase1', sourceType: 'buff', stat: 'attack', percent: 0.25 },
      { id: 'tribulation_great_dao_phase1_speed', sourceId: 'tribulation_great_dao_phase1', sourceType: 'buff', stat: 'attackSpeed', percent: 0.1 },
    ]),
    message: 'Đại Đạo Kiếp khởi động!',
  },
  {
    hpThresholdPercent: 0.4,
    buff: enrageBuff('tribulation_great_dao_phase2', 'Đại Đạo Kiếp Thịnh', [
      { id: 'tribulation_great_dao_phase2_attack', sourceId: 'tribulation_great_dao_phase2', sourceType: 'buff', stat: 'attack', percent: 0.3 },
      { id: 'tribulation_great_dao_phase2_crit', sourceId: 'tribulation_great_dao_phase2', sourceType: 'buff', stat: 'criticalRate', percent: 0.15 },
    ]),
    message: 'Đại Đạo Kiếp cực thịnh!',
  },
  {
    hpThresholdPercent: 0.15,
    buff: enrageBuff('tribulation_great_dao_phase3', 'Đại Đạo Kiếp Tận', [
      { id: 'tribulation_great_dao_phase3_attack', sourceId: 'tribulation_great_dao_phase3', sourceType: 'buff', stat: 'attack', percent: 0.35 },
      { id: 'tribulation_great_dao_phase3_speed', sourceId: 'tribulation_great_dao_phase3', sourceType: 'buff', stat: 'attackSpeed', percent: 0.2 },
      { id: 'tribulation_great_dao_phase3_critdmg', sourceId: 'tribulation_great_dao_phase3', sourceType: 'buff', stat: 'criticalDamage', percent: 0.4 },
    ]),
    message: 'Đại Đạo Kiếp bộc phát toàn lực!',
  },
]

export const TRIBULATION_HUMAN: Enemy = defineEnemy({
  id: 'tribulation_human',
  name: 'Nhân Đạo Kiếp',
  level: 9,
  realmId: 'qi_refining',
  lane: 'ground',
  archetype: 'melee',
  isBoss: true,
  tribulationPhases: HUMAN_PHASES,

  statsInput: {
    maxHp: 3000,
    attack: 110,
    attackSpeed: 4,
    movementSpeed: 50,
    attackRange: 55,
    criticalRate: 0.15,
    criticalDamage: 2.2,
    armor: 45,
    evasionRate: 15,

    elemental: { element: 'metal', power: 15 },
  },

  rewards: {
    experience: 800,
    cultivation: 2000,
    spiritStone: 200,

    itemDrops: [
      { kind: 'material', itemId: 'red-copper', amount: 4, chance: 1 },
    ],
  },
})

export const TRIBULATION_EARTH: Enemy = defineEnemy({
  id: 'tribulation_earth',
  name: 'Địa Đạo Kiếp',
  level: 11,
  realmId: 'qi_refining',
  lane: 'ground',
  archetype: 'caster',
  isBoss: true,
  tribulationPhases: EARTH_PHASES,

  statsInput: {
    maxHp: 6000,
    attack: 150,
    attackSpeed: 3.5,
    movementSpeed: 40,
    attackRange: 70,
    criticalRate: 0.15,
    criticalDamage: 2.3,
    armor: 60,
    evasionRate: 12,

    elemental: { element: 'earth', power: 20 },
  },

  rewards: {
    experience: 1500,
    cultivation: 4000,
    spiritStone: 350,

    itemDrops: [
      { kind: 'material', itemId: 'red-copper', amount: 6, chance: 1 },
    ],
  },
})

export const TRIBULATION_HEAVEN: Enemy = defineEnemy({
  id: 'tribulation_heaven',
  name: 'Thiên Đạo Kiếp',
  level: 12,
  realmId: 'qi_refining',
  lane: 'ground',
  archetype: 'ranged',
  isBoss: true,
  tribulationPhases: HEAVEN_PHASES,

  statsInput: {
    maxHp: 12000,
    attack: 200,
    attackSpeed: 4.5,
    movementSpeed: 55,
    attackRange: 90,
    criticalRate: 0.2,
    criticalDamage: 2.5,
    armor: 75,
    evasionRate: 20,

    elemental: { element: 'water', power: 25 },
  },

  rewards: {
    experience: 3000,
    cultivation: 8000,
    spiritStone: 600,

    itemDrops: [
      { kind: 'material', itemId: 'flame-essence', amount: 2, chance: 1 },
    ],
  },
})

export const TRIBULATION_GREAT_DAO: Enemy = defineEnemy({
  id: 'tribulation_great_dao',
  name: 'Đại Đạo Kiếp',
  level: 18,
  realmId: 'qi_refining',
  lane: 'ground',
  archetype: 'caster',
  isBoss: true,
  tribulationPhases: GREAT_DAO_PHASES,

  statsInput: {
    maxHp: 30000,
    attack: 350,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.25,
    criticalDamage: 2.8,
    armor: 100,
    evasionRate: 25,

    elemental: { element: 'fire', power: 35 },
  },

  rewards: {
    experience: 10000,
    cultivation: 30000,
    spiritStone: 2000,

    itemDrops: [
      { kind: 'material', itemId: 'demon-soul', amount: 2, chance: 1 },
    ],
  },
})

// Đột Phá tổng quát (2026-08-16) — 1 quái Kiếp DUY NHẤT cho mỗi đại
// cảnh giới TRỪ 'foundation' (dùng hệ Căn Cơ 4-tier riêng ở trên,
// KHÔNG đổi) — đơn giản hơn hẳn Trúc Cơ CỐ Ý: không multi-phase enrage,
// không itemDrops riêng, chỉ HP/ATK/reward leo thang theo cảnh giới
// (xem GameManager.ts's TRIBULATION_ENEMY_ID_BY_REALM). Base = stat
// TRIBULATION_GREAT_DAO (realmIndex của 'foundation'), nhân HP×3/
// ATK×1.8/reward×3 mỗi bậc realmIndex kế tiếp — thô nhưng đủ tạo cảm
// giác "càng lên cao Kiếp càng khủng khiếp" cho phần cuối game, tinh
// chỉnh lại qua playtest sau.
export const TRIBULATION_GOLDEN_CORE: Enemy = defineEnemy({
  id: 'tribulation_golden_core',
  name: 'Kim Đan Kiếp',
  level: 20,
  realmId: 'foundation',
  lane: 'ground',
  archetype: 'melee',
  isBoss: true,

  statsInput: {
    maxHp: 90000,
    attack: 630,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.27,
    criticalDamage: 3,
    armor: 120,
    evasionRate: 27,

    elemental: { element: 'metal', power: 40 },
  },

  rewards: {
    experience: 30000,
    cultivation: 90000,
    spiritStone: 6000,
  },
})

export const TRIBULATION_NASCENT_SOUL: Enemy = defineEnemy({
  id: 'tribulation_nascent_soul',
  name: 'Nguyên Anh Kiếp',
  level: 22,
  realmId: 'golden_core',
  lane: 'ground',
  archetype: 'caster',
  isBoss: true,

  statsInput: {
    maxHp: 270000,
    attack: 1134,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.29,
    criticalDamage: 3.2,
    armor: 140,
    evasionRate: 29,

    elemental: { element: 'water', power: 45 },
  },

  rewards: {
    experience: 90000,
    cultivation: 270000,
    spiritStone: 18000,
  },
})

export const TRIBULATION_SOUL_TRANSFORMATION: Enemy = defineEnemy({
  id: 'tribulation_soul_transformation',
  name: 'Hóa Thần Kiếp',
  level: 24,
  realmId: 'nascent_soul',
  lane: 'ground',
  archetype: 'ranged',
  isBoss: true,

  statsInput: {
    maxHp: 810000,
    attack: 2041,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.31,
    criticalDamage: 3.4,
    armor: 160,
    evasionRate: 31,

    elemental: { element: 'wood', power: 50 },
  },

  rewards: {
    experience: 270000,
    cultivation: 810000,
    spiritStone: 54000,
  },
})

export const TRIBULATION_VOID_REFINEMENT: Enemy = defineEnemy({
  id: 'tribulation_void_refinement',
  name: 'Luyện Hư Kiếp',
  level: 26,
  realmId: 'soul_transformation',
  lane: 'ground',
  archetype: 'melee',
  isBoss: true,

  statsInput: {
    maxHp: 2430000,
    attack: 3674,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.33,
    criticalDamage: 3.6,
    armor: 180,
    evasionRate: 33,

    elemental: { element: 'fire', power: 55 },
  },

  rewards: {
    experience: 810000,
    cultivation: 2430000,
    spiritStone: 162000,
  },
})

export const TRIBULATION_BODY_INTEGRATION: Enemy = defineEnemy({
  id: 'tribulation_body_integration',
  name: 'Hợp Thể Kiếp',
  level: 28,
  realmId: 'void_refinement',
  lane: 'ground',
  archetype: 'caster',
  isBoss: true,

  statsInput: {
    maxHp: 7290000,
    attack: 6613,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.35,
    criticalDamage: 3.8,
    armor: 200,
    evasionRate: 35,

    elemental: { element: 'earth', power: 60 },
  },

  rewards: {
    experience: 2430000,
    cultivation: 7290000,
    spiritStone: 486000,
  },
})

export const TRIBULATION_MAHAYANA: Enemy = defineEnemy({
  id: 'tribulation_mahayana',
  name: 'Đại Thừa Kiếp',
  level: 30,
  realmId: 'body_integration',
  lane: 'ground',
  archetype: 'ranged',
  isBoss: true,

  statsInput: {
    maxHp: 21870000,
    attack: 11903,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.37,
    criticalDamage: 4,
    armor: 220,
    evasionRate: 37,

    elemental: { element: 'metal', power: 65 },
  },

  rewards: {
    experience: 7290000,
    cultivation: 21870000,
    spiritStone: 1458000,
  },
})

export const TRIBULATION_TRIBULATION: Enemy = defineEnemy({
  id: 'tribulation_tribulation',
  name: 'Độ Kiếp Chi Kiếp',
  level: 32,
  realmId: 'mahayana',
  lane: 'ground',
  archetype: 'melee',
  isBoss: true,

  statsInput: {
    maxHp: 65610000,
    attack: 21426,
    attackSpeed: 5,
    movementSpeed: 60,
    attackRange: 90,
    criticalRate: 0.39,
    criticalDamage: 4.2,
    armor: 240,
    evasionRate: 39,

    elemental: { element: 'water', power: 70 },
  },

  rewards: {
    experience: 21870000,
    cultivation: 65610000,
    spiritStone: 4374000,
  },
})

export const TRIBULATIONS: Enemy[] = [
  TRIBULATION_HUMAN,
  TRIBULATION_EARTH,
  TRIBULATION_HEAVEN,
  TRIBULATION_GREAT_DAO,
  TRIBULATION_GOLDEN_CORE,
  TRIBULATION_NASCENT_SOUL,
  TRIBULATION_SOUL_TRANSFORMATION,
  TRIBULATION_VOID_REFINEMENT,
  TRIBULATION_BODY_INTEGRATION,
  TRIBULATION_MAHAYANA,
  TRIBULATION_TRIBULATION,
]
