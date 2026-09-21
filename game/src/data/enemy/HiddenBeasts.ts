import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'

// Quái ẩn (spec dot-pha-loi-kiep §4.1c) — Huyết Mông KHÔNG thuộc
// enemyPool stage nào; chỉ trà trộn pool spawn qua HiddenBeastSystem
// khi cửa sổ 1000 kill mở (xem core/game/HiddenBeastSystem.ts).
// Rơi Thiên Địa Chi Kiều 5% — nguyên liệu Kỳ Kinh (đường 9 Bát Mạch).
export const HIDDEN_BEASTS: Enemy[] = [
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
      might: 130,
      attackSpeed: 1.1,
      criticalRate: 0.1,
      criticalDamage: 2.2,
      armor: 45,
      evasionRate: 10,
      resistances: { water: 10, fire: 10 },
      elemental: { element: 'water', power: 18 },
    },
    rewards: {
      techniqueMastery: 500,
      spiritStone: 150,
    },
    signatureDrops: [
      // Thiên Địa Chi Kiều 5% — nguyên liệu Kỳ Kinh (đường 9 Bát Mạch).
      { kind: 'material', itemId: 'thien_dia_chi_kieu', amount: { min: 1, max: 1 }, chance: 0.05 },
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 12, max: 12 }, chance: 1 },
    ],
  }),
]
