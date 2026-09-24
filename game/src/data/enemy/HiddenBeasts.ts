import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'

// Quai an (spec dot-pha-loi-kiep sec.4.1c) - Huyet Mong KHONG thuoc
// enemyPool stage nao; chi tra tron pool spawn qua HiddenBeastSystem
// khi cua so 1000 kill mo (xem core/game/HiddenBeastSystem.ts).
// 2026-09-23: Thien Dia Chi Kieu signature line retired with the
// material (hidden-perfection-lineage sec.19); the Pham catch-up
// signature survives untouched.
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
      // M-QI-08 documented exception (spec sec.3.5): hand-placed Pham
      // catch-up bonus OUTSIDE the band authority - the band map
      // governs stage tables, not signature drops. Stays pham even
      // though huyet_mong sits in the qi_refining band.
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 12, max: 12 }, chance: 1 },
    ],
  }),
]
